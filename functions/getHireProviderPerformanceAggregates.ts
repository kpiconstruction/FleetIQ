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
      providerFilter,
      hvnlRelevance,
      downtimeCauseCategory
    } = body;

    const startDate = dateRangeStart;
    const endDate = dateRangeEnd;
    const ninetyDaysAgo = new Date(new Date(endDate).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Build vehicle filter query
    const vehicleQuery = { status: "Active" };
    if (stateFilter && stateFilter !== 'all') vehicleQuery.state = stateFilter;
    if (functionClassFilter && functionClassFilter !== 'all') vehicleQuery.vehicle_function_class = functionClassFilter;
    if (providerFilter && providerFilter !== 'all') vehicleQuery.hire_provider_id = providerFilter;

    // Fetch filtered vehicles, providers, and templates
    const [filteredVehicles, hireProviders, maintenanceTemplates] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.filter(vehicleQuery),
      base44.asServiceRole.entities.HireProvider.list(),
      base44.asServiceRole.entities.MaintenanceTemplate.list(),
    ]);

    const filteredVehicleIds = filteredVehicles.map(v => v.id);

    if (filteredVehicleIds.length === 0) {
      return Response.json({
        success: true,
        providers: [],
        summary: { total_downtime_hours: 0, total_providers: 0, high_risk_providers: 0, total_hvnl_overdue: 0, total_service_cost: 0, avg_on_time_rate: 0 },
      });
    }

    // Create lookup maps
    const vehicleMap = {};
    filteredVehicles.forEach(v => vehicleMap[v.id] = v);

    const providerMap = {};
    hireProviders.forEach(p => providerMap[p.id] = p);

    const templateMap = {};
    maintenanceTemplates.forEach(t => templateMap[t.id] = t);

    // Aggregate by provider
    const providerAggregates = {};

    hireProviders.forEach(provider => {
      providerAggregates[provider.id] = {
        provider_id: provider.id,
        provider_name: provider.name,
        total_downtime_hours: 0,
        downtime_events_count: 0,
        work_orders_assigned: 0,
        work_orders_completed: 0,
        work_orders_on_time: 0,
        total_turnaround_hours: 0,
        turnaround_count: 0,
        hvnl_overdue_count: 0,
        total_service_cost: 0,
        service_count: 0,
        repeat_defect_assets: new Set(),
        asset_count: 0,
        states: new Set(),
        risk_score: 0,
      };
    });

    // Count assets per provider
    filteredVehicles.forEach(v => {
      if (v.hire_provider_id && providerAggregates[v.hire_provider_id]) {
        providerAggregates[v.hire_provider_id].asset_count++;
        if (v.state) providerAggregates[v.hire_provider_id].states.add(v.state);
      }
    });

    // Fetch downtime events with filters - batch by vehicle IDs
    const downtimePromises = [];
    const batchSize = 50;
    for (let i = 0; i < filteredVehicleIds.length; i += batchSize) {
      const batch = filteredVehicleIds.slice(i, i + batchSize);
      for (const vehicleId of batch) {
        downtimePromises.push(
          base44.asServiceRole.entities.AssetDowntimeEvent.filter({ vehicle_id: vehicleId })
            .then(events => events.filter(d => {
              if (d.start_datetime < startDate || d.start_datetime > endDate) return false;
              if (downtimeCauseCategory && downtimeCauseCategory !== 'all' && d.cause_category !== downtimeCauseCategory) return false;
              return true;
            }))
        );
      }
    }
    const downtimeBatches = await Promise.all(downtimePromises);
    const periodDowntimeEvents = downtimeBatches.flat();

    periodDowntimeEvents.forEach(d => {
      const vehicle = vehicleMap[d.vehicle_id];
      if (!vehicle) return;

      const providerId = d.hire_provider_id || vehicle.hire_provider_id;
      
      // Count downtime for provider if HireProviderDelay or provider-owned asset
      if (providerId && providerAggregates[providerId]) {
        if (d.cause_category === 'HireProviderDelay' || vehicle.ownership_type === 'ContractHire') {
          providerAggregates[providerId].total_downtime_hours += d.downtime_hours || 0;
          providerAggregates[providerId].downtime_events_count++;
        }
      }
    });

    // Fetch work orders with filters - batch by vehicle IDs
    const workOrderPromises = [];
    for (let i = 0; i < filteredVehicleIds.length; i += batchSize) {
      const batch = filteredVehicleIds.slice(i, i + batchSize);
      for (const vehicleId of batch) {
        workOrderPromises.push(
          base44.asServiceRole.entities.MaintenanceWorkOrder.filter({ vehicle_id: vehicleId })
            .then(wos => wos.filter(wo => wo.raised_datetime >= startDate && wo.raised_datetime <= endDate))
        );
      }
    }
    const workOrderBatches = await Promise.all(workOrderPromises);
    const periodWorkOrders = workOrderBatches.flat();

    // Fetch service records for work order completion checks
    const serviceRecordIds = periodWorkOrders
      .filter(wo => wo.linked_service_record_id)
      .map(wo => wo.linked_service_record_id);
    
    const serviceRecordsPromises = serviceRecordIds.map(id => 
      base44.asServiceRole.entities.ServiceRecord.filter({ id })
    );
    const serviceRecordsBatches = await Promise.all(serviceRecordsPromises);
    const serviceRecords = serviceRecordsBatches.flat();

    periodWorkOrders.forEach(wo => {
      const providerId = wo.assigned_to_hire_provider_id;
      if (!providerId || !providerAggregates[providerId]) return;

      providerAggregates[providerId].work_orders_assigned++;

      if (wo.status === 'Completed' && wo.linked_service_record_id) {
        providerAggregates[providerId].work_orders_completed++;

        // Calculate turnaround time
        const serviceRecord = serviceRecords.find(s => s.id === wo.linked_service_record_id);
        if (serviceRecord && wo.due_date) {
          const dueDate = new Date(wo.due_date);
          const completionDate = new Date(serviceRecord.service_date);
          const turnaroundHours = (completionDate - new Date(wo.raised_datetime)) / (1000 * 60 * 60);
          
          providerAggregates[providerId].total_turnaround_hours += turnaroundHours;
          providerAggregates[providerId].turnaround_count++;

          // Check if on time
          if (completionDate <= dueDate) {
            providerAggregates[providerId].work_orders_on_time++;
          }
        }
      }
    });

    // Fetch all service records for cost - batch by vehicle IDs
    const allServicePromises = [];
    for (let i = 0; i < filteredVehicleIds.length; i += batchSize) {
      const batch = filteredVehicleIds.slice(i, i + batchSize);
      for (const vehicleId of batch) {
        allServicePromises.push(
          base44.asServiceRole.entities.ServiceRecord.filter({ vehicle_id: vehicleId })
            .then(records => records.filter(s => s.service_date >= startDate && s.service_date <= endDate))
        );
      }
    }
    const allServiceBatches = await Promise.all(allServicePromises);
    const periodServiceRecords = allServiceBatches.flat();

    periodServiceRecords.forEach(s => {
      const providerId = s.hire_provider_id;
      if (providerId && providerAggregates[providerId]) {
        providerAggregates[providerId].total_service_cost += s.cost_ex_gst || 0;
        providerAggregates[providerId].service_count++;
      }
    });

    // Fetch maintenance plans for HVNL exposure - batch by vehicle IDs
    const planPromises = [];
    for (let i = 0; i < filteredVehicleIds.length; i += batchSize) {
      const batch = filteredVehicleIds.slice(i, i + batchSize);
      for (const vehicleId of batch) {
        planPromises.push(
          base44.asServiceRole.entities.MaintenancePlan.filter({ vehicle_id: vehicleId, status: "Active" })
        );
      }
    }
    const planBatches = await Promise.all(planPromises);
    const maintenancePlans = planBatches.flat();

    maintenancePlans.forEach(plan => {
      const vehicle = vehicleMap[plan.vehicle_id];
      if (!vehicle) return;
      
      const providerId = vehicle.hire_provider_id;
      if (!providerId || !providerAggregates[providerId]) return;

      const template = templateMap[plan.maintenance_template_id];
      if (!template?.hvnl_relevance_flag) return;

      // Apply HVNL filter if set
      if (hvnlRelevance === 'hvnl_only') {
        // Check if overdue
        const now = new Date();
        let isOverdue = false;

        if (plan.next_due_date) {
          const dueDate = new Date(plan.next_due_date);
          if (dueDate < now) isOverdue = true;
        }

        if (plan.next_due_odometer_km && vehicle.current_odometer_km) {
          if (vehicle.current_odometer_km >= plan.next_due_odometer_km) isOverdue = true;
        }

        if (isOverdue) {
          providerAggregates[providerId].hvnl_overdue_count++;
        }
      }
    });

    // Fetch recent work orders for repeat defect analysis - batch by vehicle IDs
    const recentWOPromises = [];
    for (let i = 0; i < filteredVehicleIds.length; i += batchSize) {
      const batch = filteredVehicleIds.slice(i, i + batchSize);
      for (const vehicleId of batch) {
        recentWOPromises.push(
          base44.asServiceRole.entities.MaintenanceWorkOrder.filter({ vehicle_id: vehicleId })
            .then(wos => wos.filter(wo => wo.raised_datetime >= ninetyDaysAgo && wo.raised_datetime <= endDate))
        );
      }
    }
    const recentWOBatches = await Promise.all(recentWOPromises);
    const recentWorkOrders = recentWOBatches.flat();

    const assetRepairCount = {};
    recentWorkOrders.forEach(wo => {
      if (wo.work_order_type === 'Corrective' || wo.work_order_type === 'DefectRepair') {
        if (!assetRepairCount[wo.vehicle_id]) assetRepairCount[wo.vehicle_id] = 0;
        assetRepairCount[wo.vehicle_id]++;
      }
    });

    Object.entries(assetRepairCount).forEach(([vehicleId, count]) => {
      if (count > 2) {
        const vehicle = vehicleMap[vehicleId];
        const providerId = vehicle?.hire_provider_id;
        if (providerId && providerAggregates[providerId]) {
          providerAggregates[providerId].repeat_defect_assets.add(vehicleId);
        }
      }
    });

    // Calculate derived metrics and risk score
    const providerResults = Object.values(providerAggregates).map(p => {
      const avgTurnaroundHours = p.turnaround_count > 0 
        ? Math.round(p.total_turnaround_hours / p.turnaround_count) 
        : 0;

      const onTimeCompletionRate = p.work_orders_completed > 0
        ? Math.round((p.work_orders_on_time / p.work_orders_completed) * 100)
        : 0;

      // Calculate risk score
      let riskScore = 0;
      riskScore += p.hvnl_overdue_count * 10; // +10 per HVNL overdue
      riskScore += Math.min(p.downtime_events_count * 2, 20); // +2 per event, capped
      riskScore += Math.min((avgTurnaroundHours - 24) / 24 * 5, 15); // Turnaround delay factor
      riskScore += p.repeat_defect_assets.size * 8; // +8 per repeat defect asset
      riskScore -= onTimeCompletionRate / 2; // Reduce for good performance
      riskScore = Math.max(0, Math.min(100, riskScore));

      let riskLevel = 'Low';
      if (riskScore > 60) riskLevel = 'High';
      else if (riskScore > 30) riskLevel = 'Medium';

      return {
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        asset_count: p.asset_count,
        states: Array.from(p.states),
        total_downtime_hours: Math.round(p.total_downtime_hours),
        downtime_events_count: p.downtime_events_count,
        avg_repair_turnaround_hours: avgTurnaroundHours,
        work_orders_assigned: p.work_orders_assigned,
        work_orders_completed: p.work_orders_completed,
        on_time_completion_rate: onTimeCompletionRate,
        hvnl_overdue_count: p.hvnl_overdue_count,
        total_service_cost: Math.round(p.total_service_cost),
        service_count: p.service_count,
        repeat_defect_count: p.repeat_defect_assets.size,
        risk_score: Math.round(riskScore),
        risk_level: riskLevel,
      };
    });

    // Filter to only providers with activity
    const activeProviders = providerResults.filter(p => 
      p.asset_count > 0 || 
      p.work_orders_assigned > 0 || 
      p.downtime_events_count > 0 ||
      p.service_count > 0
    );

    // Sort by risk score descending
    activeProviders.sort((a, b) => b.risk_score - a.risk_score);

    // Calculate summary KPIs
    const summary = {
      total_downtime_hours: activeProviders.reduce((sum, p) => sum + p.total_downtime_hours, 0),
      total_providers: activeProviders.length,
      high_risk_providers: activeProviders.filter(p => p.risk_level === 'High').length,
      total_hvnl_overdue: activeProviders.reduce((sum, p) => sum + p.hvnl_overdue_count, 0),
      total_service_cost: activeProviders.reduce((sum, p) => sum + p.total_service_cost, 0),
      avg_on_time_rate: activeProviders.length > 0
        ? Math.round(activeProviders.reduce((sum, p) => sum + p.on_time_completion_rate, 0) / activeProviders.length)
        : 0,
    };

    return Response.json({
      success: true,
      providers: activeProviders,
      summary,
    });

  } catch (error) {
    console.error('Hire provider performance aggregates error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});