import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { detectCostAnomaly } from './maintenanceCostRules.js';

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

    const startDate = dateRangeStart;
    const endDate = dateRangeEnd;
    const ninetyDaysAgo = new Date(new Date(endDate).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Build vehicle filter query
    const vehicleQuery = { status: "Active" };
    if (stateFilter && stateFilter !== 'all') vehicleQuery.state = stateFilter;
    if (functionClassFilter && functionClassFilter !== 'all') vehicleQuery.vehicle_function_class = functionClassFilter;
    if (ownershipFilter && ownershipFilter !== 'all') vehicleQuery.ownership_type = ownershipFilter;
    if (providerFilter && providerFilter !== 'all') vehicleQuery.hire_provider_id = providerFilter;

    // Fetch only filtered vehicles
    const filteredVehicles = await base44.asServiceRole.entities.Vehicle.filter(vehicleQuery);
    const filteredVehicleIds = filteredVehicles.map(v => v.id);

    if (filteredVehicleIds.length === 0) {
      return Response.json({
        success: true,
        byClass: {},
        assetAggregates: [],
        summary: { total_cost: 0, total_assets: 0, repeat_repair_assets: 0 },
      });
    }

    // Fetch service records with date filter - batch by vehicle IDs
    const serviceRecordsPromises = [];
    const batchSize = 50;
    for (let i = 0; i < filteredVehicleIds.length; i += batchSize) {
      const batch = filteredVehicleIds.slice(i, i + batchSize);
      for (const vehicleId of batch) {
        serviceRecordsPromises.push(
          base44.asServiceRole.entities.ServiceRecord.filter({ vehicle_id: vehicleId })
            .then(records => records.filter(s => s.service_date >= startDate && s.service_date <= endDate))
        );
      }
    }
    const serviceRecordsBatches = await Promise.all(serviceRecordsPromises);
    const periodServiceRecords = serviceRecordsBatches.flat();

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
          totalShifts: 0,
        };
      }
      byClass[fc].assetCount++;
    });

    // Process service records for class aggregates
    periodServiceRecords.forEach(s => {
      const vehicle = vehicleMap[s.vehicle_id];
      if (!vehicle) return;
      const fc = vehicle.vehicle_function_class || 'Unknown';
      if (!byClass[fc]) return;

      // Only include costs chargeable to KPI (exclude HireProvider-paid services)
      const costChargeableTo = s.cost_chargeable_to || 'KPI';
      if (costChargeableTo !== 'HireProvider') {
        byClass[fc].totalCost += s.cost_ex_gst || 0;
      }
      byClass[fc].serviceCount++;
    });

    // Fetch usage records with date filter - batch by vehicle IDs
    const usageRecordsPromises = [];
    for (let i = 0; i < filteredVehicleIds.length; i += batchSize) {
      const batch = filteredVehicleIds.slice(i, i + batchSize);
      for (const vehicleId of batch) {
        usageRecordsPromises.push(
          base44.asServiceRole.entities.UsageRecord.filter({ vehicle_id: vehicleId })
            .then(records => records.filter(u => u.usage_date >= startDate && u.usage_date <= endDate))
        );
      }
    }
    const usageRecordsBatches = await Promise.all(usageRecordsPromises);
    const periodUsageRecords = usageRecordsBatches.flat();

    // Create vehicle lookup map
    const vehicleMap = {};
    filteredVehicles.forEach(v => vehicleMap[v.id] = v);

    periodUsageRecords.forEach(u => {
      const vehicle = vehicleMap[u.vehicle_id];
      if (!vehicle) return;
      const fc = vehicle.vehicle_function_class || 'Unknown';
      if (!byClass[fc]) return;

      byClass[fc].totalKm += u.km_travelled || 0;
      byClass[fc].totalShifts = (byClass[fc].totalShifts || 0) + (u.shifts_count || 1);
    });

    // Calculate cost per asset and cost per km/shift for each class
    Object.keys(byClass).forEach(fc => {
      const data = byClass[fc];
      data.costPerAsset = data.assetCount > 0 ? data.totalCost / data.assetCount : 0;
      data.costPer1000Km = data.totalKm > 0 ? (data.totalCost / data.totalKm) * 1000 : 0;
      data.costPerShift = data.totalShifts > 0 ? data.totalCost / data.totalShifts : 0;
    });

    // Aggregate by asset (for high-cost assets table)
    const assetAggregates = [];

    for (const vehicle of filteredVehicles) {
      const vehicleServices = periodServiceRecords.filter(s => s.vehicle_id === vehicle.id);
      
      // Only include costs chargeable to KPI (exclude HireProvider-paid services)
      const totalCost = vehicleServices.reduce((sum, s) => {
        const costChargeableTo = s.cost_chargeable_to || 'KPI';
        return sum + (costChargeableTo !== 'HireProvider' ? (s.cost_ex_gst || 0) : 0);
      }, 0);

      // Only include assets with cost > 0
      if (totalCost === 0) continue;

      const vehicleUsage = periodUsageRecords.filter(u => u.vehicle_id === vehicle.id);
      const totalKm = vehicleUsage.reduce((sum, u) => sum + (u.km_travelled || 0), 0);
      const totalShifts = vehicleUsage.reduce((sum, u) => sum + (u.shifts_count || 1), 0);

      const costPer1000Km = totalKm > 0 ? (totalCost / totalKm) * 1000 : 0;
      const costPerShift = totalShifts > 0 ? totalCost / totalShifts : 0;

      // Check for repeat repairs (corrective/defect WOs in last 90 days) - fetch only for this vehicle
      const recentCorrectiveWOs = await base44.asServiceRole.entities.MaintenanceWorkOrder.filter({
        vehicle_id: vehicle.id,
      }).then(wos => wos.filter(wo => 
        (wo.work_order_type === 'Corrective' || wo.work_order_type === 'DefectRepair') &&
        wo.raised_datetime >= ninetyDaysAgo &&
        wo.raised_datetime <= endDate
      ));

      const repeatRepairFlag = recentCorrectiveWOs.length >= repeatRepairThreshold;

      assetAggregates.push({
        vehicle_id: vehicle.id,
        asset_code: vehicle.asset_code,
        rego: vehicle.rego,
        state: vehicle.state,
        vehicle_function_class: vehicle.vehicle_function_class,
        total_cost: Math.round(totalCost),
        cost_per_1000km: Math.round(costPer1000Km),
        cost_per_shift: Math.round(costPerShift),
        service_count: vehicleServices.length,
        total_km: Math.round(totalKm),
        total_shifts: totalShifts,
        repeat_repair_flag: repeatRepairFlag,
        repeat_repair_count: recentCorrectiveWOs.length,
      });
    }

    // Sort by total cost descending
    assetAggregates.sort((a, b) => b.total_cost - a.total_cost);

    // Detect cost anomalies (hire scheduled services with non-zero costs)
    let anomalyCount = 0;
    for (const serviceRecord of periodServiceRecords) {
      const vehicle = vehicleMap[serviceRecord.vehicle_id];
      if (vehicle && detectCostAnomaly(serviceRecord, vehicle)) {
        anomalyCount++;
      }
    }

    return Response.json({
      success: true,
      byClass,
      assetAggregates,
      summary: {
        total_cost: assetAggregates.reduce((sum, a) => sum + a.total_cost, 0),
        total_assets: assetAggregates.length,
        repeat_repair_assets: assetAggregates.filter(a => a.repeat_repair_flag).length,
        cost_anomalies: anomalyCount,
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