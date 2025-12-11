import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
      providerFilter 
    } = body;

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);

    // Fetch data using service role
    const [vehicles, downtimeEvents, hireProviders] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.AssetDowntimeEvent.list('-start_datetime', 2000),
      base44.asServiceRole.entities.HireProvider.list(),
    ]);

    // Create lookup maps
    const vehicleMap = {};
    vehicles.forEach(v => vehicleMap[v.id] = v);

    const providerMap = {};
    hireProviders.forEach(p => providerMap[p.id] = p);

    // Filter vehicles
    const filteredVehicles = vehicles.filter(v => {
      if (stateFilter && stateFilter !== 'all' && v.state !== stateFilter) return false;
      if (functionClassFilter && functionClassFilter !== 'all' && v.vehicle_function_class !== functionClassFilter) return false;
      if (ownershipFilter && ownershipFilter !== 'all' && v.ownership_type !== ownershipFilter) return false;
      if (providerFilter && providerFilter !== 'all' && v.hire_provider_id !== providerFilter) return false;
      return true;
    });

    const filteredVehicleIds = new Set(filteredVehicles.map(v => v.id));

    // Filter downtime events for period
    const periodDowntimeEvents = downtimeEvents.filter(d => {
      if (!filteredVehicleIds.has(d.vehicle_id)) return false;
      const startDatetime = new Date(d.start_datetime);
      return startDatetime >= startDate && startDatetime <= endDate;
    });

    // Aggregate by cause_category
    const byCauseCategory = {};
    const categoryOrder = [
      'PreventativeService',
      'CorrectiveRepair',
      'HireProviderDelay',
      'PartsDelay',
      'IncidentRepair',
      'Other'
    ];
    categoryOrder.forEach(cat => {
      byCauseCategory[cat] = {
        downtime_hours: 0,
        event_count: 0,
      };
    });

    // Aggregate by vehicle_function_class
    const byFunctionClass = {};

    // Aggregate by hire_provider
    const byHireProvider = {};

    // Aggregate by state
    const byState = {};

    // Process downtime events
    periodDowntimeEvents.forEach(d => {
      const vehicle = vehicleMap[d.vehicle_id];
      if (!vehicle) return;

      const hours = d.downtime_hours || 0;
      const category = d.cause_category || 'Other';
      const functionClass = vehicle.vehicle_function_class || 'Unknown';
      const state = vehicle.state || 'Unknown';

      // By cause category
      if (byCauseCategory[category]) {
        byCauseCategory[category].downtime_hours += hours;
        byCauseCategory[category].event_count++;
      }

      // By function class
      if (!byFunctionClass[functionClass]) {
        byFunctionClass[functionClass] = {
          downtime_hours: 0,
          event_count: 0,
        };
      }
      byFunctionClass[functionClass].downtime_hours += hours;
      byFunctionClass[functionClass].event_count++;

      // By state
      if (!byState[state]) {
        byState[state] = {
          downtime_hours: 0,
          event_count: 0,
        };
      }
      byState[state].downtime_hours += hours;
      byState[state].event_count++;

      // By hire provider (only for hire vehicles)
      if (d.hire_provider_id || vehicle.hire_provider_id) {
        const providerId = d.hire_provider_id || vehicle.hire_provider_id;
        const providerName = providerMap[providerId]?.name || 'Unknown Provider';
        
        if (!byHireProvider[providerName]) {
          byHireProvider[providerName] = {
            downtime_hours: 0,
            event_count: 0,
            provider_id: providerId,
          };
        }
        byHireProvider[providerName].downtime_hours += hours;
        byHireProvider[providerName].event_count++;
      }
    });

    // Calculate totals and percentages
    const totalDowntimeHours = periodDowntimeEvents.reduce((sum, d) => sum + (d.downtime_hours || 0), 0);

    Object.keys(byCauseCategory).forEach(cat => {
      byCauseCategory[cat].percentage = totalDowntimeHours > 0 
        ? (byCauseCategory[cat].downtime_hours / totalDowntimeHours) * 100 
        : 0;
    });

    // Sort function classes by downtime hours
    const sortedFunctionClasses = Object.entries(byFunctionClass)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.downtime_hours - a.downtime_hours);

    // Sort hire providers by downtime hours
    const sortedHireProviders = Object.entries(byHireProvider)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.downtime_hours - a.downtime_hours);

    // Sort states by downtime hours
    const sortedStates = Object.entries(byState)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.downtime_hours - a.downtime_hours);

    return Response.json({
      success: true,
      byCauseCategory,
      byFunctionClass: sortedFunctionClasses,
      byHireProvider: sortedHireProviders,
      byState: sortedStates,
      summary: {
        total_downtime_hours: Math.round(totalDowntimeHours),
        total_events: periodDowntimeEvents.length,
        top_cause: Object.entries(byCauseCategory).sort((a, b) => b[1].downtime_hours - a[1].downtime_hours)[0]?.[0] || 'None',
        top_function_class: sortedFunctionClasses[0]?.name || 'None',
        top_hire_provider: sortedHireProviders[0]?.name || 'None',
      },
    });

  } catch (error) {
    console.error('Downtime aggregates error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});