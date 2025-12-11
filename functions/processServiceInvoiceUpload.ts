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

    // Define schema for service record extraction
    const serviceRecordSchema = {
      type: 'object',
      properties: {
        service_date: { type: 'string' },
        odometer_km: { type: 'number' },
        workshop_name: { type: 'string' },
        cost_ex_gst: { type: 'number' },
        labour_cost: { type: 'number' },
        parts_cost: { type: 'number' },
        invoice_number: { type: 'string' },
        notes: { type: 'string' },
        rego_or_asset_code: { type: 'string' }
      }
    };

    // Extract data from uploaded file
    const extractionResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: file_url,
      json_schema: serviceRecordSchema
    });

    if (extractionResult.status !== 'success' || !extractionResult.output) {
      return Response.json({
        success: false,
        error: 'Failed to extract data from invoice',
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

    // Build draft service record data
    const draftData = {
      vehicle_id: resolvedVehicleId || null,
      service_date: extracted.service_date || new Date().toISOString().split('T')[0],
      odometer_km: extracted.odometer_km || null,
      workshop_name: extracted.workshop_name || null,
      cost_ex_gst: extracted.cost_ex_gst || 0,
      labour_cost: extracted.labour_cost || null,
      parts_cost: extracted.parts_cost || null,
      invoice_number: extracted.invoice_number || null,
      notes: extracted.notes || null,
      attachment_url: file_url,
      source_system: 'Manual',
      service_type: 'Unscheduled'
    };

    // Determine if review is needed
    const needsReview = 
      !resolvedVehicleId || 
      !extracted.service_date || 
      !extracted.workshop_name ||
      extracted.cost_ex_gst === undefined;

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
    console.error('Process service invoice upload error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});