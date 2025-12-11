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

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);
    const ninetyDaysAgo = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Fetch all required data
    const [vehicles, hireProviders, downtimeEvents, workOrders, serviceRecords, maintenancePlans, maintenanceTemplates] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.HireProvider.list(),
      base44.asServiceRole.entities.AssetDowntimeEvent.list('-start_datetime', 2000),
      base44.asServiceRole.entities.MaintenanceWorkOrder.list('-raised_datetime', 2000),
      base44.asServiceRole.entities.ServiceRecord.list('-service_date', 2000),
      base44.asServiceRole.entities.MaintenancePlan.list(),
      base44.asServiceRole.entities.MaintenanceTemplate.list(),
    ]);

    // Create lookup maps
    const vehicleMap = {};
    vehicles.forEach(v => vehicleMap[v.id] = v);

    const providerMap = {};
    hireProviders.forEach(p => providerMap[p.id] = p);

    const templateMap = {};
    maintenanceTemplates.forEach(t => templateMap[t.id] = t);

    // Filter vehicles
    const filteredVehicles = vehicles.filter(v => {
      if (stateFilter && stateFilter !== 'all' && v.state !== stateFilter) return false;
      if (functionClassFilter && functionClassFilter !== 'all' && v.vehicle_function_class !== functionClassFilter) return false;
      if (providerFilter && providerFilter !== 'all' && v.hire_provider_id !== providerFilter) return false;
      return true;
    });

    const filteredVehicleIds = new Set(filteredVehicles.map(v => v.id));

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

    // Process downtime events
    const periodDowntimeEvents = downtimeEvents.filter(d => {
      if (!filteredVehicleIds.has(d.vehicle_id)) return false;
      const startDatetime = new Date(d.start_datetime);
      if (startDatetime < startDate || startDatetime > endDate) return false;
      if (downtimeCauseCategory && downtimeCauseCategory !== 'all' && d.cause_category !== downtimeCauseCategory) return false;
      return true;
    });

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

    // Process work orders
    const periodWorkOrders = workOrders.filter(wo => {
      if (!filteredVehicleIds.has(wo.vehicle_id)) return false;
      const raisedDate = new Date(wo.raised_datetime);
      return raisedDate >= startDate && raisedDate <= endDate;
    });

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

    // Process service records for cost
    const periodServiceRecords = serviceRecords.filter(s => {
      if (!filteredVehicleIds.has(s.vehicle_id)) return false;
      const serviceDate = new Date(s.service_date);
      return serviceDate >= startDate && serviceDate <= endDate;
    });

    periodServiceRecords.forEach(s => {
      const providerId = s.hire_provider_id;
      if (providerId && providerAggregates[providerId]) {
        providerAggregates[providerId].total_service_cost += s.cost_ex_gst || 0;
        providerAggregates[providerId].service_count++;
      }
    });

    // Process maintenance plans for HVNL exposure
    maintenancePlans.forEach(plan => {
      if (plan.status !== 'Active') return;
      
      const vehicle = vehicleMap[plan.vehicle_id];
      if (!vehicle || !filteredVehicleIds.has(vehicle.id)) return;
      
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

    // Check for repeat defects (corrective/defect WOs on same asset within 90 days)
    const recentWorkOrders = workOrders.filter(wo => {
      const raisedDate = new Date(wo.raised_datetime);
      return raisedDate >= ninetyDaysAgo && raisedDate <= endDate;
    });

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