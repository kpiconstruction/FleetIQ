import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getCached, setCached } from './services/aggregateCache.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { dateRangeStart, dateRangeEnd, stateFilter, functionClassFilter, ownershipFilter, providerFilter } = body;

    // Check cache first
    const cacheKey = { dateRangeStart, dateRangeEnd, stateFilter, functionClassFilter, ownershipFilter, providerFilter };
    const cached = getCached('getMaintenanceComplianceAggregates', cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);
    const now = new Date();

    // Get enriched maintenance plan schedule
    const scheduleResponse = await base44.asServiceRole.functions.invoke('getMaintenancePlanSchedule', {
      stateFilter,
      functionClassFilter,
      ownershipFilter,
      providerFilter,
    });

    const enrichedPlans = scheduleResponse.data.plans || [];

    // Fetch work orders and service records
    const [workOrders, serviceRecords] = await Promise.all([
      base44.asServiceRole.entities.MaintenanceWorkOrder.list('-raised_datetime', 2000),
      base44.asServiceRole.entities.ServiceRecord.list('-service_date', 2000),
    ]);

    // Initialize aggregates structure
    const aggregates = {
      byState: {},
      byFunctionClass: {},
      overall: {
        plansDueInPeriod: 0,
        servicesCompletedOnTime: 0,
        servicesCompletedLate: 0,
        plansStillOverdue: 0,
        onTimeCompliancePercent: 0,
        preventativeCompletionRatio: 0,
      },
      hvnl: {
        plansDueInPeriod: 0,
        servicesCompletedOnTime: 0,
        servicesCompletedLate: 0,
        plansStillOverdue: 0,
        hvnlCompliancePercent: 0,
      },
    };

    // Helper function to initialize aggregate structure
    const initAggregate = () => ({
      plansDueInPeriod: 0,
      servicesCompletedOnTime: 0,
      servicesCompletedLate: 0,
      plansStillOverdue: 0,
      onTimeCompliancePercent: 0,
    });

    // Process enriched maintenance plans
    enrichedPlans.forEach(plan => {
      const state = plan.vehicle.state;
      const functionClass = plan.vehicle.vehicle_function_class;
      const isHVNL = plan.is_hvnl_critical;

      // Initialize state and function class aggregates
      if (!aggregates.byState[state]) aggregates.byState[state] = initAggregate();
      if (!aggregates.byFunctionClass[functionClass]) aggregates.byFunctionClass[functionClass] = initAggregate();

      // Check if plan was due in period
      let wasDueInPeriod = false;
      if (plan.next_due_date) {
        const dueDate = new Date(plan.next_due_date);
        if (dueDate >= startDate && dueDate <= endDate) {
          wasDueInPeriod = true;
        }
      }

      if (wasDueInPeriod) {
        aggregates.overall.plansDueInPeriod++;
        aggregates.byState[state].plansDueInPeriod++;
        aggregates.byFunctionClass[functionClass].plansDueInPeriod++;
        if (isHVNL) aggregates.hvnl.plansDueInPeriod++;

        // Check if there's a linked work order that was completed
        const linkedWO = workOrders.find(wo => 
          wo.maintenance_plan_id === plan.id && 
          wo.status === 'Completed' &&
          wo.linked_service_record_id
        );

        if (linkedWO) {
          const linkedService = serviceRecords.find(s => s.id === linkedWO.linked_service_record_id);
          if (linkedService) {
            const serviceDate = new Date(linkedService.service_date);
            const dueDate = new Date(plan.next_due_date);

            if (serviceDate <= dueDate) {
              // Completed on time
              aggregates.overall.servicesCompletedOnTime++;
              aggregates.byState[state].servicesCompletedOnTime++;
              aggregates.byFunctionClass[functionClass].servicesCompletedOnTime++;
              if (isHVNL) aggregates.hvnl.servicesCompletedOnTime++;
            } else {
              // Completed late
              aggregates.overall.servicesCompletedLate++;
              aggregates.byState[state].servicesCompletedLate++;
              aggregates.byFunctionClass[functionClass].servicesCompletedLate++;
              if (isHVNL) aggregates.hvnl.servicesCompletedLate++;
            }
          }
        }
      }

      // Check if plan is still overdue at period end
      if (plan.is_overdue && plan.next_due_date && new Date(plan.next_due_date) < endDate) {
        // Check if not completed
        const linkedWO = workOrders.find(wo => 
          wo.maintenance_plan_id === plan.id && 
          wo.status === 'Completed'
        );
        if (!linkedWO) {
          aggregates.overall.plansStillOverdue++;
          aggregates.byState[state].plansStillOverdue++;
          aggregates.byFunctionClass[functionClass].plansStillOverdue++;
          if (isHVNL) aggregates.hvnl.plansStillOverdue++;
        }
      }
    });

    // Calculate percentages
    const calculatePercent = (agg) => {
      const total = agg.servicesCompletedOnTime + agg.servicesCompletedLate;
      agg.onTimeCompliancePercent = total > 0 ? ((agg.servicesCompletedOnTime / total) * 100).toFixed(1) : 0;
    };

    // Overall
    calculatePercent(aggregates.overall);
    aggregates.overall.preventativeCompletionRatio = 
      aggregates.overall.plansDueInPeriod > 0
        ? ((aggregates.overall.servicesCompletedOnTime / aggregates.overall.plansDueInPeriod) * 100).toFixed(1)
        : 0;

    // By State
    Object.keys(aggregates.byState).forEach(state => {
      calculatePercent(aggregates.byState[state]);
    });

    // By Function Class
    Object.keys(aggregates.byFunctionClass).forEach(fc => {
      calculatePercent(aggregates.byFunctionClass[fc]);
    });

    // HVNL Compliance
    const hvnlTotal = aggregates.hvnl.servicesCompletedOnTime + aggregates.hvnl.servicesCompletedLate;
    aggregates.hvnl.hvnlCompliancePercent = 
      hvnlTotal > 0 
        ? ((aggregates.hvnl.servicesCompletedOnTime / hvnlTotal) * 100).toFixed(1) 
        : 0;

    const result = {
      success: true,
      aggregates,
      filters: {
        dateRangeStart,
        dateRangeEnd,
        stateFilter,
        functionClassFilter,
        ownershipFilter,
        providerFilter,
      },
    };

    // Cache for 3 minutes
    setCached('getMaintenanceComplianceAggregates', cacheKey, result, 3 * 60 * 1000);

    return Response.json(result);

  } catch (error) {
    console.error('Maintenance compliance aggregates error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});