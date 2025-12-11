import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { logAutomationRun, isAutomationEnabled } from './services/fleetLogger.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { defect_id } = await req.json();
    
    if (!defect_id) {
      return Response.json({ error: 'defect_id is required' }, { status: 400 });
    }

    // Check if Migration Mode is enabled
    const migrationMode = await isAutomationEnabled(base44, 'MIGRATION_MODE_ENABLED');
    if (migrationMode) {
      console.log('[autoCreateDefectWorkOrder] Skipped - Migration Mode active');
      return Response.json({
        success: true,
        message: 'Migration Mode active - automation disabled',
        created: false,
      });
    }

    // Check if automation is enabled
    const enabled = await isAutomationEnabled(base44, 'AUTO_WO_FROM_DEFECTS_ENABLED');
    if (!enabled) {
      return Response.json({ 
        success: true, 
        message: 'Defect-based work order automation is disabled',
        created: false
      });
    }

    // Fetch the defect
    const defects = await base44.asServiceRole.entities.PrestartDefect.filter({ id: defect_id });
    if (!defects || defects.length === 0) {
      return Response.json({ error: 'Defect not found' }, { status: 404 });
    }
    
    const defect = defects[0];

    // Check eligibility
    const eligible = 
      (defect.severity === 'High' || defect.severity === 'Critical') &&
      defect.status === 'Open' &&
      defect.vehicle_id;

    if (!eligible) {
      return Response.json({ 
        success: true, 
        message: 'Defect does not meet criteria for auto WO creation',
        created: false,
        reason: 'Not High/Critical or not Open or no vehicle_id'
      });
    }

    // Check if a WO already exists for this defect
    const existingWOs = await base44.asServiceRole.entities.MaintenanceWorkOrder.filter({
      linked_prestart_defect_id: defect_id
    });

    const hasOpenWO = existingWOs.some(wo => wo.status === 'Open' || wo.status === 'InProgress');
    if (hasOpenWO) {
      return Response.json({ 
        success: true, 
        message: 'Work order already exists for this defect',
        created: false
      });
    }

    // Map severity to priority
    const priority = defect.severity === 'Critical' ? 'SafetyCritical' : 'Major';

    // Create auto work order
    const woData = {
      vehicle_id: defect.vehicle_id,
      work_order_type: 'DefectRepair',
      raised_from: 'PrestartDefect',
      linked_prestart_defect_id: defect_id,
      raised_datetime: new Date().toISOString(),
      status: 'Open',
      priority: priority,
      odometer_at_raise: 0,
      notes_internal: `[AUTO] Auto WO from prestart defect ${defect_id}: ${defect.defect_description}. Severity: ${defect.severity}.`
    };

    const newWO = await base44.asServiceRole.entities.MaintenanceWorkOrder.create(woData);

    await logAutomationRun(base44, 'autoCreateDefectWorkOrder', 'Success', {
      created: 1,
      defect_id,
      work_order_id: newWO.id,
    });

    return Response.json({
      success: true,
      created: true,
      work_order_id: newWO.id,
      defect_id: defect_id,
      priority: priority
    });

  } catch (error) {
    console.error('Auto create defect work order error:', error);
    
    const base44 = createClientFromRequest(req);
    await logAutomationRun(base44, 'autoCreateDefectWorkOrder', 'Failed', {
      error: error.message,
    });
    
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});