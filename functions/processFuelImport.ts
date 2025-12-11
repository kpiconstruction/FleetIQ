import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { hasPermission } from './checkPermissions.js';
import { isAutomationEnabled } from './services/fleetLogger.js';

/**
 * Process Fuel Card CSV/Excel Import
 * Handles: parsing, mapping, validation, vehicle resolution, and commit
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!hasPermission(user, 'uploadMigrationData')) {
      return Response.json({ 
        error: 'Forbidden: Only FleetAdmin or WorkshopOps can import fuel data' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { action, batch_id, row_id, row_data, file_url, mapping_template } = body;

    // 1. Update individual row
    if (action === 'updateRow') {
      if (!row_id || !row_data) {
        return Response.json({ error: 'row_id and row_data required' }, { status: 400 });
      }

      await base44.asServiceRole.entities.ImportedFuelRow.update(row_id, row_data);
      return Response.json({ success: true, row_id });
    }

    // 2. Validate and map
    if (action === 'validateAndMap') {
      if (!batch_id) {
        return Response.json({ error: 'batch_id required' }, { status: 400 });
      }

      const batch = (await base44.asServiceRole.entities.FuelImportBatch.filter({ id: batch_id }))[0];
      if (!batch) {
        return Response.json({ error: 'Batch not found' }, { status: 404 });
      }

      // Fetch all rows for this batch
      const rows = await base44.asServiceRole.entities.ImportedFuelRow.filter({ 
        fuel_import_batch_id: batch_id 
      });

      // If > 1000 rows, process in background
      if (rows.length > 1000) {
        // For large batches, return immediate response and process async
        console.log(`[FuelImport] Large batch (${rows.length} rows), processing in background...`);
        
        // Trigger background processing
        setTimeout(async () => {
          await validateAndMapRows(base44, batch, rows);
        }, 0);

        return Response.json({
          success: true,
          message: 'Processing in background',
          total_rows: rows.length,
          batch_id,
        });
      }

      // Process synchronously for smaller batches
      await validateAndMapRows(base44, batch, rows);

      return Response.json({
        success: true,
        message: 'Validation complete',
        batch_id,
      });
    }

    // 3. Commit to FuelTransaction
    if (action === 'commit') {
      // Check Migration Mode
      const migrationMode = await isAutomationEnabled(base44, 'MIGRATION_MODE_ENABLED');
      if (migrationMode) {
        return Response.json({
          error: 'Migration Mode is active - data commits are disabled.',
          migrationMode: true,
        }, { status: 403 });
      }

      if (!hasPermission(user, 'commitMigrationBatch')) {
        return Response.json({ error: 'Only FleetAdmin can commit batches' }, { status: 403 });
      }

      if (!batch_id) {
        return Response.json({ error: 'batch_id required' }, { status: 400 });
      }

      const batch = (await base44.asServiceRole.entities.FuelImportBatch.filter({ id: batch_id }))[0];
      if (!batch) {
        return Response.json({ error: 'Batch not found' }, { status: 404 });
      }

      if (batch.status === 'Committed') {
        return Response.json({ error: 'Batch already committed' }, { status: 400 });
      }

      // Fetch eligible rows (only Ready status)
      const allRowsForCommit = await base44.asServiceRole.entities.ImportedFuelRow.filter({
        fuel_import_batch_id: batch_id,
      });
      
      const readyRows = allRowsForCommit.filter(r => r.resolution_status === 'Ready');

      if (readyRows.length === 0) {
        return Response.json({ 
          success: false,
          error: 'Nothing to commit: there are no rows with status Ready.',
        }, { status: 400 });
      }

      // Pre-commit validation: reject if any unresolved rows exist
      const allRows = await base44.asServiceRole.entities.ImportedFuelRow.filter({
        fuel_import_batch_id: batch_id,
      });
      
      const unresolvedRows = allRows.filter(r => 
        ['Unmapped', 'VehicleNotFound', 'InvalidData', 'Duplicate'].includes(r.resolution_status)
      );

      if (unresolvedRows.length > 0) {
        const statusCounts = {
          Unmapped: unresolvedRows.filter(r => r.resolution_status === 'Unmapped').length,
          VehicleNotFound: unresolvedRows.filter(r => r.resolution_status === 'VehicleNotFound').length,
          InvalidData: unresolvedRows.filter(r => r.resolution_status === 'InvalidData').length,
          Duplicate: unresolvedRows.filter(r => r.resolution_status === 'Duplicate').length,
        };
        
        const statusSummary = Object.entries(statusCounts)
          .filter(([_, count]) => count > 0)
          .map(([status, count]) => `${count} ${status}`)
          .join(', ');

        return Response.json({
          success: false,
          error: `Cannot commit: ${unresolvedRows.length} rows are unresolved (${statusSummary}). Only Ready or Ignored rows may remain.`,
          unresolvedCounts: statusCounts,
        }, { status: 400 });
      }

      // Commit all ready rows with error handling
      let committed = 0;
      let failed = 0;
      let totalLitres = 0;
      let totalCost = 0;
      const failedRows = [];

      for (const row of readyRows) {
        try {
          const fuelData = {
            vehicle_id: row.mapped_vehicle_id,
            transaction_datetime: row.mapped_transaction_datetime,
            card_number: row.mapped_card_number,
            driver_name: row.mapped_driver_name,
            litres: row.mapped_litres,
            total_cost: row.mapped_total_cost_ex_gst,
            unit_price: row.mapped_price_per_litre,
            fuel_type: row.mapped_fuel_type,
            site_location: row.mapped_site_location,
            supplier_name: row.mapped_provider_name,
            source: 'FuelCardCSV',
            source_reference: row.external_reference || batch.file_name,
          };

          await base44.asServiceRole.entities.FuelTransaction.create(fuelData);
          
          await base44.asServiceRole.entities.ImportedFuelRow.update(row.id, {
            resolution_status: 'Committed',
          });

          committed++;
          totalLitres += row.mapped_litres || 0;
          totalCost += row.mapped_total_cost_ex_gst || 0;
        } catch (rowError) {
          console.error(`Failed to create fuel transaction for row ${row.id}:`, rowError);
          failed++;
          failedRows.push({
            rego: row.mapped_rego,
            error: rowError.message
          });
          
          // Mark row as invalid with error details
          await base44.asServiceRole.entities.ImportedFuelRow.update(row.id, {
            resolution_status: 'InvalidData',
            resolution_notes: `Commit failed: ${rowError.message}`
          });
        }
      }

      // Update batch status (only if at least one row was successful)
      if (committed > 0) {
        await base44.asServiceRole.entities.FuelImportBatch.update(batch_id, {
          status: 'Committed',
          committed_by_user_id: user.id,
          committed_at: new Date().toISOString(),
          summary_json: {
            total_rows: allRowsForCommit.length,
            committed: committed,
            failed: failed,
            total_litres: Math.round(totalLitres),
            total_cost: Math.round(totalCost),
            ignored: allRowsForCommit.filter(r => r.resolution_status === 'Ignored').length,
            committedAt: new Date().toISOString(),
          },
        });
      }

      console.log(`[FuelImport] Committed batch ${batch_id}: ${committed} transactions, ${failed} failed, ${Math.round(totalLitres)}L, $${Math.round(totalCost)}`);

      return Response.json({
        success: true,
        committed,
        failed,
        partialCommit: failed > 0,
        total_litres: Math.round(totalLitres),
        total_cost: Math.round(totalCost),
        batch_id,
        failureDetails: failed > 0 ? failedRows : undefined,
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Process fuel import error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});

/**
 * Validate and map fuel import rows
 */
async function validateAndMapRows(base44, batch, rows) {
  const vehicles = await base44.asServiceRole.entities.Vehicle.list();
  const vehiclesByRego = {};
  vehicles.forEach(v => {
    if (v.rego) vehiclesByRego[v.rego.toUpperCase()] = v;
  });

  for (const row of rows) {
    try {
      // Skip already processed rows
      if (row.resolution_status === 'Committed' || row.resolution_status === 'Ignored') {
        continue;
      }

      const updates = {};

      // Validate required fields
      if (!row.mapped_transaction_datetime) {
        updates.resolution_status = 'InvalidData';
        updates.resolution_notes = 'Missing transaction date/time';
      } else if (!row.mapped_litres || row.mapped_litres < 0) {
        updates.resolution_status = 'InvalidData';
        updates.resolution_notes = 'Missing or invalid litres';
      } else if (!row.mapped_total_cost_ex_gst || row.mapped_total_cost_ex_gst < 0) {
        updates.resolution_status = 'InvalidData';
        updates.resolution_notes = 'Missing or invalid cost';
      } else if (!row.mapped_vehicle_id) {
        // Try to auto-resolve by rego
        if (row.mapped_rego) {
          const regoKey = row.mapped_rego.toUpperCase();
          const vehicle = vehiclesByRego[regoKey];
          if (vehicle) {
            updates.mapped_vehicle_id = vehicle.id;
            updates.resolution_status = 'Ready';
            updates.resolution_notes = 'Auto-resolved by rego';
          } else {
            updates.resolution_status = 'VehicleNotFound';
            updates.resolution_notes = 'Vehicle not found by rego';
          }
        } else {
          updates.resolution_status = 'VehicleNotFound';
          updates.resolution_notes = 'No vehicle ID or rego provided';
        }
      } else {
        // Check for duplicates (same vehicle + datetime + litres + cost)
        const existingTransactions = await base44.asServiceRole.entities.FuelTransaction.filter({
          vehicle_id: row.mapped_vehicle_id,
        });

        const isDuplicate = existingTransactions.some(t => 
          t.transaction_datetime === row.mapped_transaction_datetime &&
          Math.abs((t.litres || 0) - (row.mapped_litres || 0)) < 0.1 &&
          Math.abs((t.total_cost || 0) - (row.mapped_total_cost_ex_gst || 0)) < 0.5
        );

        if (isDuplicate) {
          updates.resolution_status = 'Duplicate';
          updates.resolution_notes = 'Duplicate transaction detected';
        } else {
          updates.resolution_status = 'Ready';
          updates.resolution_notes = 'Ready to commit';
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.ImportedFuelRow.update(row.id, updates);
      }

    } catch (error) {
      console.error(`[FuelImport] Error validating row ${row.id}:`, error);
      await base44.asServiceRole.entities.ImportedFuelRow.update(row.id, {
        resolution_status: 'InvalidData',
        resolution_notes: `Validation error: ${error.message}`,
      });
    }
  }

  // Update batch status
  const validatedRows = await base44.asServiceRole.entities.ImportedFuelRow.filter({
    fuel_import_batch_id: batch.id,
  });

  const statusCounts = {};
  validatedRows.forEach(r => {
    statusCounts[r.resolution_status] = (statusCounts[r.resolution_status] || 0) + 1;
  });

  await base44.asServiceRole.entities.FuelImportBatch.update(batch.id, {
    status: statusCounts.Ready > 0 ? 'ReadyToCommit' : 'Validating',
    summary_json: {
      total_rows: validatedRows.length,
      by_status: statusCounts,
    },
  });

  console.log(`[FuelImport] Validated batch ${batch.id}:`, statusCounts);
}