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
      providerFilter,
      repeatRepairThreshold = 3 
    } = body;

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);
    const ninetyDaysAgo = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Fetch data using service role
    const [vehicles, serviceRecords, usageRecords, workOrders] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.ServiceRecord.list('-service_date', 2000),
      base44.asServiceRole.entities.UsageRecord.list('-usage_date', 5000),
      base44.asServiceRole.entities.MaintenanceWorkOrder.list('-raised_datetime', 1000),
    ]);

    // Filter vehicles
    const filteredVehicles = vehicles.filter(v => {
      if (stateFilter && stateFilter !== 'all' && v.state !== stateFilter) return false;
      if (functionClassFilter && functionClassFilter !== 'all' && v.vehicle_function_class !== functionClassFilter) return false;
      if (ownershipFilter && ownershipFilter !== 'all' && v.ownership_type !== ownershipFilter) return false;
      if (providerFilter && providerFilter !== 'all' && v.hire_provider_id !== providerFilter) return false;
      return true;
    });

    const filteredVehicleIds = new Set(filteredVehicles.map(v => v.id));

    // Filter service records for period
    const periodServiceRecords = serviceRecords.filter(s => {
      if (!filteredVehicleIds.has(s.vehicle_id)) return false;
      const serviceDate = new Date(s.service_date);
      return serviceDate >= startDate && serviceDate <= endDate;
    });

    // Aggregate by vehicle_function_class
    const byClass = {};
    filteredVehicles.forEach(v => {
      const fc = v.vehicle_function_class || 'Unknown';
      if (!byClass[fc]) {
        byClass[fc] = {
          totalCost: 0,
          assetCount: 0,
          serviceCount: 0,
          totalKm: 0,
          totalHours: 0,
        };
      }
      byClass[fc].assetCount++;
    });

    // Process service records for class aggregates
    periodServiceRecords.forEach(s => {
      const vehicle = vehicles.find(v => v.id === s.vehicle_id);
      if (!vehicle) return;
      const fc = vehicle.vehicle_function_class || 'Unknown';
      if (!byClass[fc]) return;

      byClass[fc].totalCost += s.cost_ex_gst || 0;
      byClass[fc].serviceCount++;
    });

    // Process usage records for class aggregates
    const periodUsageRecords = usageRecords.filter(u => {
      if (!filteredVehicleIds.has(u.vehicle_id)) return false;
      const usageDate = new Date(u.usage_date);
      return usageDate >= startDate && usageDate <= endDate;
    });

    periodUsageRecords.forEach(u => {
      const vehicle = vehicles.find(v => v.id === u.vehicle_id);
      if (!vehicle) return;
      const fc = vehicle.vehicle_function_class || 'Unknown';
      if (!byClass[fc]) return;

      byClass[fc].totalKm += u.km_travelled || 0;
      byClass[fc].totalHours += u.total_hours || 0;
    });

    // Calculate cost per asset and cost per km/hour for each class
    Object.keys(byClass).forEach(fc => {
      const data = byClass[fc];
      data.costPerAsset = data.assetCount > 0 ? data.totalCost / data.assetCount : 0;
      data.costPer1000Km = data.totalKm > 0 ? (data.totalCost / data.totalKm) * 1000 : 0;
      data.costPerHour = data.totalHours > 0 ? data.totalCost / data.totalHours : 0;
    });

    // Aggregate by asset (for high-cost assets table)
    const assetAggregates = [];

    filteredVehicles.forEach(vehicle => {
      const vehicleServices = periodServiceRecords.filter(s => s.vehicle_id === vehicle.id);
      const totalCost = vehicleServices.reduce((sum, s) => sum + (s.cost_ex_gst || 0), 0);

      // Only include assets with cost > 0
      if (totalCost === 0) return;

      const vehicleUsage = periodUsageRecords.filter(u => u.vehicle_id === vehicle.id);
      const totalKm = vehicleUsage.reduce((sum, u) => sum + (u.km_travelled || 0), 0);
      const totalHours = vehicleUsage.reduce((sum, u) => sum + (u.total_hours || 0), 0);

      const costPer1000Km = totalKm > 0 ? (totalCost / totalKm) * 1000 : 0;
      const costPerHour = totalHours > 0 ? totalCost / totalHours : 0;

      // Check for repeat repairs (corrective/defect WOs in last 90 days)
      const recentCorrectiveWOs = workOrders.filter(wo => {
        if (wo.vehicle_id !== vehicle.id) return false;
        if (wo.work_order_type !== 'Corrective' && wo.work_order_type !== 'DefectRepair') return false;
        const raisedDate = new Date(wo.raised_datetime);
        return raisedDate >= ninetyDaysAgo && raisedDate <= endDate;
      });

      const repeatRepairFlag = recentCorrectiveWOs.length >= repeatRepairThreshold;

      assetAggregates.push({
        vehicle_id: vehicle.id,
        asset_code: vehicle.asset_code,
        rego: vehicle.rego,
        state: vehicle.state,
        vehicle_function_class: vehicle.vehicle_function_class,
        total_cost: Math.round(totalCost),
        cost_per_1000km: Math.round(costPer1000Km),
        cost_per_hour: Math.round(costPerHour),
        service_count: vehicleServices.length,
        total_km: Math.round(totalKm),
        total_hours: Math.round(totalHours),
        repeat_repair_flag: repeatRepairFlag,
        repeat_repair_count: recentCorrectiveWOs.length,
      });
    });

    // Sort by total cost descending
    assetAggregates.sort((a, b) => b.total_cost - a.total_cost);

    return Response.json({
      success: true,
      byClass,
      assetAggregates,
      summary: {
        total_cost: assetAggregates.reduce((sum, a) => sum + a.total_cost, 0),
        total_assets: assetAggregates.length,
        repeat_repair_assets: assetAggregates.filter(a => a.repeat_repair_flag).length,
      },
    });

  } catch (error) {
    console.error('Maintenance cost aggregates error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});