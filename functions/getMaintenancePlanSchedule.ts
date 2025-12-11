import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Computes derived scheduling fields for a MaintenancePlan
 * @param {Object} plan - MaintenancePlan entity
 * @param {Object} vehicle - Vehicle entity
 * @param {Object} template - MaintenanceTemplate entity
 * @returns {Object} Computed scheduling details
 */
function computePlanDerivedFields(plan, vehicle, template) {
  if (!vehicle || !template) {
    return {
      next_due_date: null,
      next_due_odometer_km: null,
      status: 'Unknown',
      days_until_due: null,
      days_overdue: null,
    };
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let nextDueDate = plan.next_due_date ? new Date(plan.next_due_date) : null;
  let nextDueOdometer = plan.next_due_odometer_km;

  // Calculate next due date based on trigger type
  if (template.trigger_type === 'TimeBased' || template.trigger_type === 'Hybrid') {
    if (!nextDueDate && template.interval_days) {
      const baseDate = plan.last_completed_date
        ? new Date(plan.last_completed_date)
        : vehicle.in_service_date
        ? new Date(vehicle.in_service_date)
        : now;
      nextDueDate = new Date(baseDate.getTime() + template.interval_days * 24 * 60 * 60 * 1000);
    }
  }

  // Calculate next due odometer based on trigger type
  if (template.trigger_type === 'OdometerBased' || template.trigger_type === 'Hybrid') {
    if (!nextDueOdometer && template.interval_km) {
      const baseOdometer = plan.last_completed_odometer_km || vehicle.current_odometer_km || 0;
      nextDueOdometer = baseOdometer + template.interval_km;
    }
  }

  // Determine status
  let status = 'OnTrack';
  let daysUntilDue = null;
  let daysOverdue = null;

  // Check date-based overdue
  let isOverdue = false;
  if (nextDueDate) {
    const daysDiff = Math.floor((nextDueDate - now) / (1000 * 60 * 60 * 24));
    
    if (nextDueDate < now) {
      isOverdue = true;
      status = 'Overdue';
      daysOverdue = Math.abs(daysDiff);
    } else if (nextDueDate <= thirtyDaysFromNow) {
      status = 'DueSoon';
      daysUntilDue = daysDiff;
    } else {
      daysUntilDue = daysDiff;
    }
  }

  // Check odometer-based overdue (overrides date-based if triggered)
  if (nextDueOdometer && vehicle.current_odometer_km && vehicle.current_odometer_km >= nextDueOdometer) {
    isOverdue = true;
    status = 'Overdue';
    // For odometer-based overdue, daysOverdue represents km over
    daysOverdue = vehicle.current_odometer_km - nextDueOdometer;
  }

  return {
    next_due_date: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
    next_due_odometer_km: nextDueOdometer,
    status,
    days_until_due: !isOverdue ? daysUntilDue : null,
    days_overdue: isOverdue ? daysOverdue : null,
    is_overdue: isOverdue,
    is_due_soon: status === 'DueSoon',
    is_hvnl_critical: template.hvnl_relevance_flag || false,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      dateRangeStart, 
      dateRangeEnd, 
      stateFilter, 
      functionClassFilter, 
      ownershipFilter, 
      providerFilter,
      statusFilter 
    } = body;

    // Fetch all required data
    const [vehicles, maintenancePlans, maintenanceTemplates] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.MaintenancePlan.list(),
      base44.asServiceRole.entities.MaintenanceTemplate.list(),
    ]);

    // Create lookup maps
    const vehicleMap = {};
    vehicles.forEach(v => vehicleMap[v.id] = v);

    const templateMap = {};
    maintenanceTemplates.forEach(t => templateMap[t.id] = t);

    // Filter vehicles
    const filteredVehicles = vehicles.filter(v => {
      if (stateFilter && stateFilter !== 'all' && v.state !== stateFilter) return false;
      if (functionClassFilter && functionClassFilter !== 'all' && v.vehicle_function_class !== functionClassFilter) return false;
      if (ownershipFilter && ownershipFilter !== 'all' && v.ownership_type !== ownershipFilter) return false;
      if (providerFilter && providerFilter !== 'all' && v.hire_provider_id !== providerFilter) return false;
      return true;
    });

    const filteredVehicleIds = new Set(filteredVehicles.map(v => v.id));

    // Compute enriched plans
    const enrichedPlans = maintenancePlans
      .filter(plan => filteredVehicleIds.has(plan.vehicle_id))
      .map(plan => {
        const vehicle = vehicleMap[plan.vehicle_id];
        const template = templateMap[plan.maintenance_template_id];

        if (!vehicle || !template) return null;

        const computed = computePlanDerivedFields(plan, vehicle, template);

        // Apply date range filter if provided
        if (dateRangeStart && dateRangeEnd && computed.next_due_date) {
          if (computed.next_due_date < dateRangeStart || computed.next_due_date > dateRangeEnd) {
            return null;
          }
        }

        // Apply status filter if provided
        if (statusFilter && statusFilter !== 'all') {
          if (statusFilter === 'upcoming' && computed.status !== 'DueSoon') return null;
          if (statusFilter === 'overdue' && computed.status !== 'Overdue') return null;
        }

        return {
          ...plan,
          vehicle: {
            id: vehicle.id,
            asset_code: vehicle.asset_code,
            rego: vehicle.rego,
            state: vehicle.state,
            vehicle_function_class: vehicle.vehicle_function_class,
            ownership_type: vehicle.ownership_type,
            hire_provider_id: vehicle.hire_provider_id,
            current_odometer_km: vehicle.current_odometer_km,
          },
          template: {
            id: template.id,
            name: template.name,
            trigger_type: template.trigger_type,
            priority: template.priority,
            hvnl_relevance_flag: template.hvnl_relevance_flag,
            task_summary: template.task_summary,
          },
          ...computed,
        };
      })
      .filter(Boolean);

    // Calculate summary metrics
    const summary = {
      total_plans: enrichedPlans.length,
      overdue_count: enrichedPlans.filter(p => p.status === 'Overdue').length,
      due_soon_count: enrichedPlans.filter(p => p.status === 'DueSoon').length,
      on_track_count: enrichedPlans.filter(p => p.status === 'OnTrack').length,
      hvnl_critical_overdue: enrichedPlans.filter(p => p.is_overdue && p.is_hvnl_critical).length,
    };

    return Response.json({
      success: true,
      plans: enrichedPlans,
      summary,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Maintenance plan schedule error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});