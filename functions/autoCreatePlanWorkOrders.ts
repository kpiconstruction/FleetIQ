import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { logAutomationRun, isAutomationEnabled } from './services/fleetLogger.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check if Migration Mode is enabled
    const migrationMode = await isAutomationEnabled(base44, 'MIGRATION_MODE_ENABLED');
    if (migrationMode) {
      console.log('[autoCreatePlanWorkOrders] Skipped - Migration Mode active');
      await logAutomationRun(base44, 'autoCreatePlanWorkOrders', 'Success', {
        message: 'Migration Mode active - no records created',
        created: 0,
      });
      return Response.json({
        success: true,
        message: 'Migration Mode active - automation disabled',
        created: 0,
      });
    }
    
    // Check if automation is enabled
    const enabled = await isAutomationEnabled(base44, 'AUTO_WO_FROM_PLANS_ENABLED');
    if (!enabled) {
      return Response.json({ 
        success: true, 
        message: 'Plan-based work order automation is disabled',
        created: 0 
      });
    }

    // Get threshold configuration
    const thresholdConfigs = await base44.asServiceRole.entities.AutomationConfig.filter({ key: 'AUTO_WO_PLAN_DUE_DAYS' });
    const dueThresholdDays = thresholdConfigs.length > 0 ? parseInt(thresholdConfigs[0].value) : 14;

    // Fetch maintenance plan schedule
    const scheduleResponse = await base44.asServiceRole.functions.invoke('getMaintenancePlanSchedule', {
      stateFilter: 'all',
      functionClassFilter: 'all',
      ownershipFilter: 'all',
      providerFilter: 'all',
      statusFilter: 'all'
    });

    const plans = scheduleResponse.data.plans || [];
    const created = [];

    for (const plan of plans) {
      // Check if plan is eligible for auto WO creation
      const eligible = 
        (plan.status === 'OnTrack' || plan.status === 'DueSoon') &&
        plan.days_until_due !== null &&
        plan.days_until_due <= dueThresholdDays;

      if (!eligible) continue;

      // Check if an open scheduled WO already exists for this plan
      const existingWOs = await base44.asServiceRole.entities.MaintenanceWorkOrder.filter({
        vehicle_id: plan.vehicle_id,
        maintenance_plan_id: plan.id,
        work_order_type: 'Scheduled'
      });

      const hasOpenWO = existingWOs.some(wo => wo.status === 'Open' || wo.status === 'InProgress');
      if (hasOpenWO) continue;

      // Create auto work order
      const woData = {
        vehicle_id: plan.vehicle_id,
        maintenance_plan_id: plan.id,
        maintenance_template_id: plan.maintenance_template_id,
        work_order_type: 'Scheduled',
        raised_from: 'Schedule',
        raised_datetime: new Date().toISOString(),
        due_date: plan.next_due_date || null,
        status: 'Open',
        priority: plan.template?.priority || 'Routine',
        odometer_at_raise: plan.vehicle.current_odometer_km || 0,
        notes_internal: `[AUTO] Auto-generated scheduled service`,
        notes_for_provider: `Auto-generated scheduled service from plan ${plan.template?.name || 'N/A'} – due on ${plan.next_due_date || 'N/A'} / ${plan.next_due_odometer_km ? plan.next_due_odometer_km + ' km' : 'N/A'}.`
      };

      const newWO = await base44.asServiceRole.entities.MaintenanceWorkOrder.create(woData);
      created.push({
        work_order_id: newWO.id,
        vehicle_id: plan.vehicle_id,
        asset_code: plan.vehicle.asset_code,
        plan_id: plan.id
      });
    }

    await logAutomationRun(base44, 'autoCreatePlanWorkOrders', 'Success', {
      created: created.length,
      threshold_days: dueThresholdDays,
    });

    return Response.json({
      success: true,
      created_count: created.length,
      work_orders: created,
      threshold_days: dueThresholdDays
    });

  } catch (error) {
    console.error('Auto create plan work orders error:', error);
    
    const base44 = createClientFromRequest(req);
    await logAutomationRun(base44, 'autoCreatePlanWorkOrders', 'Failed', {
      error: error.message,
    });
    
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});