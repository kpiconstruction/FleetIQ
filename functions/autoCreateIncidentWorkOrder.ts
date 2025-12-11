import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { logAutomationRun, isAutomationEnabled } from './services/fleetLogger.js';

/**
 * Auto-create work orders from serious/critical incidents
 * Controlled by AUTO_WO_FROM_INCIDENTS_ENABLED
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Check Migration Mode
    const migrationMode = await isAutomationEnabled(base44, 'MIGRATION_MODE_ENABLED');
    if (migrationMode) {
      console.log('[autoCreateIncidentWorkOrder] Skipped - Migration Mode active');
      await logAutomationRun(base44, 'autoCreateIncidentWorkOrder', 'Success', {
        message: 'Migration Mode active - no records created',
        created: 0,
      });
      return Response.json({
        success: true,
        message: 'Migration Mode active - automation disabled',
        created: 0,
      });
    }

    // Check if automation enabled
    const enabled = await isAutomationEnabled(base44, 'AUTO_WO_FROM_INCIDENTS_ENABLED');
    if (!enabled) {
      return Response.json({
        success: true,
        message: 'Incident-based work order automation is disabled',
        created: 0,
      });
    }

    // Fetch serious/critical open incidents
    const incidents = await base44.asServiceRole.entities.IncidentRecord.list();
    
    const targetIncidents = incidents.filter(i =>
      (i.status === 'Open' || i.status === 'Under Investigation') &&
      (i.severity === 'Serious' || i.severity === 'Critical') &&
      i.vehicle_id
    );

    console.log(`[autoCreateIncidentWorkOrder] Found ${targetIncidents.length} serious/critical incidents`);

    const created = [];

    for (const incident of targetIncidents) {
      try {
        // Check if WO already exists for this incident
        const existingWOs = await base44.asServiceRole.entities.MaintenanceWorkOrder.filter({
          linked_incident_id: incident.id,
        });

        const hasOpenWO = existingWOs.some(wo => wo.status === 'Open' || wo.status === 'InProgress');
        
        if (hasOpenWO) {
          console.log(`[autoCreateIncidentWorkOrder] Incident ${incident.id} already has open WO, skipping`);
          continue;
        }

        // Map severity to priority
        const priority = (incident.severity === 'Critical' || incident.severity === 'Serious') 
          ? 'SafetyCritical' 
          : 'Major';

        // Create work order
        const woData = {
          vehicle_id: incident.vehicle_id,
          work_order_type: 'Corrective',
          raised_from: 'Incident',
          linked_incident_id: incident.id,
          raised_datetime: new Date().toISOString(),
          status: 'Open',
          priority,
          notes_internal: `[AUTO] Incident #${incident.id.slice(0, 8)}: ${incident.incident_type} – ${
            incident.description?.slice(0, 150) || 'No description'
          }${incident.description?.length > 150 ? '...' : ''}`,
          odometer_at_raise: 0, // Will be updated when assigned
        };

        const newWO = await base44.asServiceRole.entities.MaintenanceWorkOrder.create(woData);
        created.push(newWO.id);

        // Log to AlertLog
        await base44.asServiceRole.entities.AlertLog.create({
          alert_type: 'WorkOrderOverdue',
          sent_at: new Date().toISOString(),
          recipients: 'System',
          subject: `Auto-created WO from ${incident.severity} incident`,
          related_entity_type: 'IncidentRecord',
          related_entity_id: incident.id,
          status: 'Success',
        });

        console.log(`[autoCreateIncidentWorkOrder] Created WO ${newWO.id} for incident ${incident.id}`);

      } catch (error) {
        console.error(`[autoCreateIncidentWorkOrder] Error processing incident ${incident.id}:`, error);
      }
    }

    await logAutomationRun(base44, 'autoCreateIncidentWorkOrder', 'Success', {
      incidents_checked: targetIncidents.length,
      work_orders_created: created.length,
    });

    return Response.json({
      success: true,
      created_count: created.length,
      work_order_ids: created,
    });

  } catch (error) {
    console.error('Auto create incident work order error:', error);

    const base44 = createClientFromRequest(req);
    await logAutomationRun(base44, 'autoCreateIncidentWorkOrder', 'Failed', {
      error: error.message,
    });

    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});