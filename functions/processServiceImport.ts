import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, batchId, rows, mapping, includeDuplicates } = body;

    if (action === 'validateAndMap') {
      // Fetch vehicles for matching
      const vehicles = await base44.asServiceRole.entities.Vehicle.list();
      
      // Fetch existing service records for duplicate detection
      const existingServices = await base44.asServiceRole.entities.ServiceRecord.list('-service_date', 5000);

      const validatedRows = [];

      for (const row of rows) {
        const mappedRow = {
          raw_row_json: row,
          resolution_status: 'Unmapped',
          resolution_notes: '',
        };

        // Apply mapping
        if (mapping) {
          mappedRow.mapped_asset_code = row[mapping.asset_code] || row[mapping.rego] || row[mapping.vin];
          mappedRow.mapped_service_date = row[mapping.service_date];
          mappedRow.mapped_odometer_km = parseFloat(row[mapping.odometer_km]) || null;
          mappedRow.mapped_workshop_name = row[mapping.workshop_name];
          mappedRow.mapped_service_type = row[mapping.service_type] || 'Unscheduled';
          mappedRow.mapped_labour_cost = parseFloat(row[mapping.labour_cost]) || null;
          mappedRow.mapped_parts_cost = parseFloat(row[mapping.parts_cost]) || null;
          mappedRow.mapped_total_cost = parseFloat(row[mapping.total_cost]) || null;
          mappedRow.mapped_notes = row[mapping.notes];
          mappedRow.external_reference = row[mapping.external_reference];
        }

        // Validate date
        if (mappedRow.mapped_service_date) {
          const date = new Date(mappedRow.mapped_service_date);
          if (isNaN(date.getTime())) {
            mappedRow.resolution_status = 'InvalidData';
            mappedRow.resolution_notes = 'Invalid service date';
            validatedRows.push(mappedRow);
            continue;
          }
        } else {
          mappedRow.resolution_status = 'InvalidData';
          mappedRow.resolution_notes = 'Missing service date';
          validatedRows.push(mappedRow);
          continue;
        }

        // Find vehicle
        const vehicle = vehicles.find(v => 
          v.asset_code === mappedRow.mapped_asset_code ||
          v.rego === mappedRow.mapped_asset_code ||
          v.vin === mappedRow.mapped_asset_code
        );

        if (!vehicle) {
          mappedRow.resolution_status = 'VehicleNotFound';
          mappedRow.resolution_notes = `Vehicle not found: ${mappedRow.mapped_asset_code}`;
          validatedRows.push(mappedRow);
          continue;
        }

        mappedRow.mapped_vehicle_id = vehicle.id;

        // Check for duplicates
        const serviceDate = new Date(mappedRow.mapped_service_date);
        const oneDayBefore = new Date(serviceDate);
        oneDayBefore.setDate(oneDayBefore.getDate() - 1);
        const oneDayAfter = new Date(serviceDate);
        oneDayAfter.setDate(oneDayAfter.getDate() + 1);

        const isDuplicate = existingServices.some(s => {
          if (s.vehicle_id !== vehicle.id) return false;
          
          const existingDate = new Date(s.service_date);
          const withinDateRange = existingDate >= oneDayBefore && existingDate <= oneDayAfter;
          
          const withinOdoRange = mappedRow.mapped_odometer_km && s.odometer_km
            ? Math.abs(s.odometer_km - mappedRow.mapped_odometer_km) <= 200
            : true;
          
          const sameReference = mappedRow.external_reference && s.source_reference
            ? s.source_reference === mappedRow.external_reference
            : false;

          return withinDateRange && (withinOdoRange || sameReference);
        });

        if (isDuplicate) {
          mappedRow.resolution_status = 'Duplicate';
          mappedRow.resolution_notes = 'Potential duplicate service record';
        } else {
          mappedRow.resolution_status = 'Mapped';
          mappedRow.resolution_notes = 'Ready for commit';
        }

        validatedRows.push(mappedRow);
      }

      // Calculate summary
      const summary = {
        total: validatedRows.length,
        mapped: validatedRows.filter(r => r.resolution_status === 'Mapped').length,
        vehicleNotFound: validatedRows.filter(r => r.resolution_status === 'VehicleNotFound').length,
        invalidData: validatedRows.filter(r => r.resolution_status === 'InvalidData').length,
        duplicate: validatedRows.filter(r => r.resolution_status === 'Duplicate').length,
      };

      return Response.json({
        success: true,
        validatedRows,
        summary,
      });
    }

    if (action === 'commit') {
      // Fetch batch
      const batches = await base44.asServiceRole.entities.ImportBatch.filter({ id: batchId });
      const batch = batches[0];

      if (!batch) {
        return Response.json({ error: 'Batch not found' }, { status: 404 });
      }

      if (batch.status === 'Committed') {
        return Response.json({ error: 'Batch already committed' }, { status: 400 });
      }

      // Fetch rows for this batch
      const importedRows = await base44.asServiceRole.entities.ImportedServiceRow.filter({ 
        import_batch_id: batchId 
      });

      // Filter rows eligible for commit
      let eligibleRows = importedRows.filter(r => 
        r.resolution_status === 'Mapped' || r.resolution_status === 'Ready'
      );

      // Include duplicates if requested
      if (includeDuplicates) {
        const duplicateRows = importedRows.filter(r => r.resolution_status === 'Duplicate');
        eligibleRows = [...eligibleRows, ...duplicateRows];
      }

      // Create service records
      const serviceRecords = [];
      for (const row of eligibleRows) {
        const serviceRecord = {
          vehicle_id: row.mapped_vehicle_id,
          service_date: row.mapped_service_date,
          odometer_km: row.mapped_odometer_km,
          workshop_name: row.mapped_workshop_name,
          service_type: row.mapped_service_type || 'Unscheduled',
          labour_cost: row.mapped_labour_cost,
          parts_cost: row.mapped_parts_cost,
          cost_ex_gst: row.mapped_total_cost,
          notes: row.mapped_notes,
          source_system: batch.source_system,
          source_reference: row.external_reference,
          import_batch_id: batchId,
          imported_row_id: row.id,
        };

        // Remove null/undefined values
        Object.keys(serviceRecord).forEach(key => {
          if (serviceRecord[key] === null || serviceRecord[key] === undefined) {
            delete serviceRecord[key];
          }
        });

        serviceRecords.push(serviceRecord);
      }

      // Bulk create
      await base44.asServiceRole.entities.ServiceRecord.bulkCreate(serviceRecords);

      // Update imported rows to Committed
      for (const row of eligibleRows) {
        await base44.asServiceRole.entities.ImportedServiceRow.update(row.id, {
          resolution_status: 'Committed'
        });
      }

      // Update batch status
      await base44.asServiceRole.entities.ImportBatch.update(batchId, {
        status: 'Committed',
        committed_by_user_id: user.id,
        committed_at: new Date().toISOString(),
        summary_json: {
          ...batch.summary_json,
          committed: serviceRecords.length,
          committedAt: new Date().toISOString(),
        }
      });

      return Response.json({
        success: true,
        recordsCreated: serviceRecords.length,
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Service import processing error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});