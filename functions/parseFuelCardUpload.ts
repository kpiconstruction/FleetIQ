import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { hasPermission } from './checkPermissions.js';

/**
 * Parse uploaded fuel card CSV/Excel file
 * Extracts rows and creates ImportedFuelRow records
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user, 'uploadMigrationData')) {
      return Response.json({ 
        error: 'Forbidden: Only FleetAdmin or WorkshopOps can upload fuel data' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { file_url, file_name, source_system = 'FleetCardCSV', mapping_template } = body;

    if (!file_url || !file_name) {
      return Response.json({ error: 'file_url and file_name required' }, { status: 400 });
    }

    console.log(`[FuelImport] Parsing file: ${file_name}`);

    // Fetch file content
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return Response.json({ error: 'Failed to fetch file' }, { status: 500 });
    }

    const fileText = await fileResponse.text();
    
    // Parse CSV
    const rows = parseCSV(fileText);
    
    if (rows.length === 0) {
      return Response.json({ error: 'No data rows found in file' }, { status: 400 });
    }

    console.log(`[FuelImport] Parsed ${rows.length} rows`);

    // Create batch
    const batch = await base44.asServiceRole.entities.FuelImportBatch.create({
      file_name,
      source_system,
      created_by_user_id: user.id,
      status: 'Uploaded',
      mapping_template: mapping_template || null,
      summary_json: {
        total_rows: rows.length,
        uploaded_at: new Date().toISOString(),
      },
    });

    // Apply mapping if template provided
    const mappedRows = rows.map(row => {
      const mappedRow = {
        fuel_import_batch_id: batch.id,
        raw_row_json: row,
        resolution_status: 'Unmapped',
      };

      if (mapping_template) {
        // Apply column mappings
        if (mapping_template.card_number) {
          mappedRow.mapped_card_number = row[mapping_template.card_number];
        }
        if (mapping_template.rego) {
          mappedRow.mapped_rego = row[mapping_template.rego];
        }
        if (mapping_template.transaction_datetime) {
          mappedRow.mapped_transaction_datetime = parseDateTime(row[mapping_template.transaction_datetime]);
        }
        if (mapping_template.litres) {
          mappedRow.mapped_litres = parseFloat(row[mapping_template.litres]) || 0;
        }
        if (mapping_template.total_cost_ex_gst) {
          mappedRow.mapped_total_cost_ex_gst = parseFloat(row[mapping_template.total_cost_ex_gst]) || 0;
        }
        if (mapping_template.price_per_litre) {
          mappedRow.mapped_price_per_litre = parseFloat(row[mapping_template.price_per_litre]) || 0;
        }
        if (mapping_template.fuel_type) {
          mappedRow.mapped_fuel_type = row[mapping_template.fuel_type];
        }
        if (mapping_template.site_location) {
          mappedRow.mapped_site_location = row[mapping_template.site_location];
        }
        if (mapping_template.site_postcode) {
          mappedRow.mapped_site_postcode = row[mapping_template.site_postcode];
        }
        if (mapping_template.provider_name) {
          mappedRow.mapped_provider_name = row[mapping_template.provider_name];
        }
        if (mapping_template.driver_name) {
          mappedRow.mapped_driver_name = row[mapping_template.driver_name];
        }
        if (mapping_template.external_reference) {
          mappedRow.external_reference = row[mapping_template.external_reference];
        }

        mappedRow.resolution_status = 'Mapped';
      }

      return mappedRow;
    });

    // Bulk create rows (batch in chunks of 100 to avoid payload limits)
    const chunkSize = 100;
    let created = 0;

    for (let i = 0; i < mappedRows.length; i += chunkSize) {
      const chunk = mappedRows.slice(i, i + chunkSize);
      await base44.asServiceRole.entities.ImportedFuelRow.bulkCreate(chunk);
      created += chunk.length;
    }

    // Update batch status
    await base44.asServiceRole.entities.FuelImportBatch.update(batch.id, {
      status: mapping_template ? 'MappingPending' : 'Uploaded',
      summary_json: {
        ...batch.summary_json,
        rows_created: created,
      },
    });

    console.log(`[FuelImport] Created batch ${batch.id} with ${created} rows`);

    return Response.json({
      success: true,
      batch_id: batch.id,
      rows_parsed: rows.length,
      rows_created: created,
      sample_rows: rows.slice(0, 5),
    });

  } catch (error) {
    console.error('Parse fuel card upload error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});

/**
 * Simple CSV parser (handles quoted fields and commas)
 */
function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse date/time string into ISO format
 */
function parseDateTime(str) {
  if (!str) return null;
  
  try {
    const date = new Date(str);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}