/**
 * DEPRECATED: Fuel Receipt OCR Upload
 * 
 * This function is DEPRECATED and should not be used in production.
 * KPI Fleet IQ uses CSV/Excel imports from fleet card providers via /FuelImport page.
 * 
 * This function remains for backward compatibility only and is not exposed in the UI.
 * For fuel data ingestion, use processFuelImport with CSV/Excel files.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, vehicle_id } = await req.json();
    
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Define schema for fuel transaction extraction
    const fuelTransactionSchema = {
      type: 'object',
      properties: {
        transaction_datetime: { type: 'string' },
        litres: { type: 'number' },
        total_cost: { type: 'number' },
        unit_price: { type: 'number' },
        site_location: { type: 'string' },
        fuel_type: { type: 'string' },
        odometer_at_fill: { type: 'number' },
        receipt_number: { type: 'string' },
        rego_or_asset_code: { type: 'string' }
      }
    };

    // Extract data from uploaded file
    const extractionResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: file_url,
      json_schema: fuelTransactionSchema
    });

    if (extractionResult.status !== 'success' || !extractionResult.output) {
      return Response.json({
        success: false,
        error: 'Failed to extract data from fuel receipt',
        details: extractionResult.details
      }, { status: 400 });
    }

    const extracted = extractionResult.output;
    let resolvedVehicleId = vehicle_id;

    // Try to resolve vehicle if not provided
    if (!resolvedVehicleId && extracted.rego_or_asset_code) {
      const vehiclesByRego = await base44.asServiceRole.entities.Vehicle.filter({ 
        rego: extracted.rego_or_asset_code 
      });
      const vehiclesByAssetCode = await base44.asServiceRole.entities.Vehicle.filter({ 
        asset_code: extracted.rego_or_asset_code 
      });
      
      if (vehiclesByRego.length > 0) {
        resolvedVehicleId = vehiclesByRego[0].id;
      } else if (vehiclesByAssetCode.length > 0) {
        resolvedVehicleId = vehiclesByAssetCode[0].id;
      }
    }

    // Build draft fuel transaction data
    const draftData = {
      vehicle_id: resolvedVehicleId || null,
      transaction_datetime: extracted.transaction_datetime || new Date().toISOString(),
      litres: extracted.litres || 0,
      total_cost: extracted.total_cost || 0,
      unit_price: extracted.unit_price || (extracted.total_cost && extracted.litres ? extracted.total_cost / extracted.litres : 0),
      site_location: extracted.site_location || null,
      fuel_type: extracted.fuel_type || 'Diesel',
      odometer_at_fill: extracted.odometer_at_fill || null,
      source: 'Manual',
      source_reference: extracted.receipt_number || file_url
    };

    // Determine if review is needed
    const needsReview = 
      !resolvedVehicleId || 
      !extracted.litres || 
      !extracted.total_cost;

    return Response.json({
      success: true,
      extracted_data: draftData,
      needs_review: needsReview,
      confidence: needsReview ? 'low' : 'high',
      message: needsReview 
        ? 'Some fields could not be reliably extracted – please review carefully.' 
        : 'Data extracted successfully. Please confirm before saving.'
    });

  } catch (error) {
    console.error('Process fuel receipt upload error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});