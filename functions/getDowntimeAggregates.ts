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

    const startDate = dateRangeStart;
    const endDate = dateRangeEnd;

    // Build vehicle filter query
    const vehicleQuery = { status: "Active" };
    if (stateFilter && stateFilter !== 'all') vehicleQuery.state = stateFilter;
    if (functionClassFilter && functionClassFilter !== 'all') vehicleQuery.vehicle_function_class = functionClassFilter;
    if (ownershipFilter && ownershipFilter !== 'all') vehicleQuery.ownership_type = ownershipFilter;
    if (providerFilter && providerFilter !== 'all') vehicleQuery.hire_provider_id = providerFilter;

    // Fetch only filtered vehicles and hire providers
    const [filteredVehicles, hireProviders] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.filter(vehicleQuery),
      base44.asServiceRole.entities.HireProvider.list(),
    ]);

    const filteredVehicleIds = filteredVehicles.map(v => v.id);

    if (filteredVehicleIds.length === 0) {
      return Response.json({
        success: true,
        byCauseCategory: {},
        byFunctionClass: [],
        byHireProvider: [],
        byState: [],
        summary: { total_downtime_hours: 0, total_events: 0, top_cause: 'None', top_function_class: 'None', top_hire_provider: 'None' },
      });
    }

    // Fetch downtime events with filters - batch by vehicle IDs
    const downtimePromises = [];
    const batchSize = 50;
    for (let i = 0; i < filteredVehicleIds.length; i += batchSize) {
      const batch = filteredVehicleIds.slice(i, i + batchSize);
      for (const vehicleId of batch) {
        downtimePromises.push(
          base44.asServiceRole.entities.AssetDowntimeEvent.filter({ vehicle_id: vehicleId })
            .then(events => events.filter(d => d.start_datetime >= startDate && d.start_datetime <= endDate))
        );
      }
    }
    const downtimeBatches = await Promise.all(downtimePromises);
    const periodDowntimeEvents = downtimeBatches.flat();

    // Create lookup maps
    const vehicleMap = {};
    filteredVehicles.forEach(v => vehicleMap[v.id] = v);

    const providerMap = {};
    hireProviders.forEach(p => providerMap[p.id] = p);

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