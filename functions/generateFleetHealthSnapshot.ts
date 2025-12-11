import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { hasPermission } from './checkPermissions.js';
import { logAutomationRun } from './services/fleetLogger.js';

/**
 * Generate Fleet IQ Health Snapshot Report
 * Captures complete system state before Trae migration
 * READ-ONLY - no data mutations
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only FleetAdmin can generate snapshots
    if (!hasPermission(user, 'createMaintenanceTemplate')) {
      return Response.json({ 
        error: 'Forbidden: Only FleetAdmin can generate health snapshots',
        yourRole: user.fleet_role || 'None'
      }, { status: 403 });
    }

    console.log('[HealthSnapshot] Starting generation...');

    // Fetch all data in parallel
    const [
      vehicles,
      maintenancePlans,
      workOrders,
      prestartDefects,
      incidents,
      serviceRecords,
      downtimeEvents,
      usageRecords,
      workerRiskStatuses,
    ] = await Promise.all([
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.MaintenancePlan.list(),
      base44.asServiceRole.entities.MaintenanceWorkOrder.list(),
      base44.asServiceRole.entities.PrestartDefect.list(),
      base44.asServiceRole.entities.IncidentRecord.list(),
      base44.asServiceRole.entities.ServiceRecord.list('-service_date', 5000),
      base44.asServiceRole.entities.AssetDowntimeEvent.list('-start_datetime', 5000),
      base44.asServiceRole.entities.UsageRecord.list('-usage_date', 5000),
      base44.asServiceRole.entities.WorkerRiskStatus.list(),
    ]);

    const timestamp = new Date().toISOString();
    const now = new Date();

    // Calculate date ranges
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // ========== COUNTS ==========
    const counts = {
      vehicles: {
        total: vehicles.length,
        by_state: {},
        by_ownership: {},
        by_function_class: {},
        by_status: {},
      },
      maintenance_plans: {
        total: maintenancePlans.length,
        active: maintenancePlans.filter(p => p.status === 'Active').length,
        suspended: maintenancePlans.filter(p => p.status === 'Suspended').length,
      },
      work_orders: {
        total: workOrders.length,
        open: workOrders.filter(wo => wo.status === 'Open').length,
        in_progress: workOrders.filter(wo => wo.status === 'InProgress').length,
        overdue: workOrders.filter(wo => 
          (wo.status === 'Open' || wo.status === 'InProgress') &&
          wo.due_date && wo.due_date < timestamp.split('T')[0]
        ).length,
        completed: workOrders.filter(wo => wo.status === 'Completed').length,
        by_type: {},
        by_priority: {},
      },
      prestart_defects: {
        total: prestartDefects.length,
        open: prestartDefects.filter(d => d.status === 'Open').length,
        open_high: prestartDefects.filter(d => d.status === 'Open' && d.severity === 'High').length,
        open_critical: prestartDefects.filter(d => d.status === 'Open' && d.severity === 'Critical').length,
        by_severity: {},
      },
      incidents: {
        total: incidents.length,
        open: incidents.filter(i => i.status === 'Open' || i.status === 'Under Investigation').length,
        serious_critical: incidents.filter(i => 
          (i.status === 'Open' || i.status === 'Under Investigation') &&
          (i.severity === 'Serious' || i.severity === 'Critical')
        ).length,
        by_severity: {},
        by_type: {},
      },
      worker_risk: {
        total: workerRiskStatuses.length,
        red: workerRiskStatuses.filter(w => w.current_risk_level === 'Red').length,
        amber: workerRiskStatuses.filter(w => w.current_risk_level === 'Amber').length,
        green: workerRiskStatuses.filter(w => w.current_risk_level === 'Green').length,
      },
    };

    // Group vehicles by dimensions
    vehicles.forEach(v => {
      counts.vehicles.by_state[v.state] = (counts.vehicles.by_state[v.state] || 0) + 1;
      counts.vehicles.by_ownership[v.ownership_type] = (counts.vehicles.by_ownership[v.ownership_type] || 0) + 1;
      counts.vehicles.by_function_class[v.vehicle_function_class] = (counts.vehicles.by_function_class[v.vehicle_function_class] || 0) + 1;
      counts.vehicles.by_status[v.status] = (counts.vehicles.by_status[v.status] || 0) + 1;
    });

    // Group work orders
    workOrders.forEach(wo => {
      counts.work_orders.by_type[wo.work_order_type] = (counts.work_orders.by_type[wo.work_order_type] || 0) + 1;
      counts.work_orders.by_priority[wo.priority] = (counts.work_orders.by_priority[wo.priority] || 0) + 1;
    });

    // Group defects and incidents
    prestartDefects.forEach(d => {
      counts.prestart_defects.by_severity[d.severity] = (counts.prestart_defects.by_severity[d.severity] || 0) + 1;
    });
    incidents.forEach(i => {
      counts.incidents.by_severity[i.severity] = (counts.incidents.by_severity[i.severity] || 0) + 1;
      counts.incidents.by_type[i.incident_type] = (counts.incidents.by_type[i.incident_type] || 0) + 1;
    });

    // ========== KPIs ==========
    
    // Maintenance compliance (fetch from aggregates)
    const [compliance3m, compliance6m, compliance12m] = await Promise.all([
      base44.asServiceRole.functions.invoke('getMaintenanceComplianceAggregates', {
        dateRangeStart: threeMonthsAgo.toISOString().split('T')[0],
        dateRangeEnd: timestamp.split('T')[0],
        stateFilter: 'all',
        functionClassFilter: 'all',
        ownershipFilter: 'all',
        providerFilter: 'all',
      }),
      base44.asServiceRole.functions.invoke('getMaintenanceComplianceAggregates', {
        dateRangeStart: sixMonthsAgo.toISOString().split('T')[0],
        dateRangeEnd: timestamp.split('T')[0],
        stateFilter: 'all',
        functionClassFilter: 'all',
        ownershipFilter: 'all',
        providerFilter: 'all',
      }),
      base44.asServiceRole.functions.invoke('getMaintenanceComplianceAggregates', {
        dateRangeStart: twelveMonthsAgo.toISOString().split('T')[0],
        dateRangeEnd: timestamp.split('T')[0],
        stateFilter: 'all',
        functionClassFilter: 'all',
        ownershipFilter: 'all',
        providerFilter: 'all',
      }),
    ]);

    // Service costs (last 12 months)
    const serviceRecords12m = serviceRecords.filter(s => 
      new Date(s.service_date) >= twelveMonthsAgo
    );
    
    const costKPI = serviceRecords12m
      .filter(s => s.cost_chargeable_to === 'KPI')
      .reduce((sum, s) => sum + (s.cost_ex_gst || 0), 0);
    
    const costHireProvider = serviceRecords12m
      .filter(s => s.cost_chargeable_to === 'HireProvider')
      .reduce((sum, s) => sum + (s.cost_ex_gst || 0), 0);

    // Downtime (last 12 months)
    const downtimeEvents12m = downtimeEvents.filter(e =>
      new Date(e.start_datetime) >= twelveMonthsAgo
    );

    const downtimeByCause = {};
    downtimeEvents12m.forEach(e => {
      const cause = e.cause_category || 'Unknown';
      downtimeByCause[cause] = (downtimeByCause[cause] || 0) + (e.downtime_hours || 0);
    });

    // Odometer confidence
    const odometerConfidence = {
      High: vehicles.filter(v => v.odometer_data_confidence === 'High').length,
      Medium: vehicles.filter(v => v.odometer_data_confidence === 'Medium').length,
      Low: vehicles.filter(v => v.odometer_data_confidence === 'Low').length,
      Unknown: vehicles.filter(v => v.odometer_data_confidence === 'Unknown' || !v.odometer_data_confidence).length,
    };

    const kpis = {
      maintenance_compliance: {
        last_3_months: {
          on_time_percent: compliance3m.data?.aggregates?.overall?.onTimeCompliancePercent || 0,
          plans_due: compliance3m.data?.aggregates?.overall?.plansDueInPeriod || 0,
          completed_on_time: compliance3m.data?.aggregates?.overall?.servicesCompletedOnTime || 0,
          completed_late: compliance3m.data?.aggregates?.overall?.servicesCompletedLate || 0,
        },
        last_6_months: {
          on_time_percent: compliance6m.data?.aggregates?.overall?.onTimeCompliancePercent || 0,
          plans_due: compliance6m.data?.aggregates?.overall?.plansDueInPeriod || 0,
          completed_on_time: compliance6m.data?.aggregates?.overall?.servicesCompletedOnTime || 0,
          completed_late: compliance6m.data?.aggregates?.overall?.servicesCompletedLate || 0,
        },
        last_12_months: {
          on_time_percent: compliance12m.data?.aggregates?.overall?.onTimeCompliancePercent || 0,
          plans_due: compliance12m.data?.aggregates?.overall?.plansDueInPeriod || 0,
          completed_on_time: compliance12m.data?.aggregates?.overall?.servicesCompletedOnTime || 0,
          completed_late: compliance12m.data?.aggregates?.overall?.servicesCompletedLate || 0,
        },
      },
      hvnl_compliance: {
        last_12_months: {
          compliance_percent: compliance12m.data?.aggregates?.hvnl?.hvnlCompliancePercent || 0,
          plans_due: compliance12m.data?.aggregates?.hvnl?.plansDueInPeriod || 0,
          completed_on_time: compliance12m.data?.aggregates?.hvnl?.servicesCompletedOnTime || 0,
          completed_late: compliance12m.data?.aggregates?.hvnl?.servicesCompletedLate || 0,
          still_overdue: compliance12m.data?.aggregates?.hvnl?.plansStillOverdue || 0,
        },
      },
      maintenance_costs_12m: {
        total: costKPI + costHireProvider,
        kpi_paid: costKPI,
        hire_provider_paid: costHireProvider,
        percentage_kpi: costKPI + costHireProvider > 0 
          ? ((costKPI / (costKPI + costHireProvider)) * 100).toFixed(1)
          : 0,
      },
      downtime_12m: {
        total_hours: downtimeEvents12m.reduce((sum, e) => sum + (e.downtime_hours || 0), 0),
        total_events: downtimeEvents12m.length,
        by_cause: downtimeByCause,
      },
      odometer_data_quality: {
        distribution: odometerConfidence,
        high_confidence_percent: vehicles.length > 0 
          ? ((odometerConfidence.High / vehicles.length) * 100).toFixed(1)
          : 0,
      },
    };

    // ========== BUILD SNAPSHOT ==========
    const snapshot = {
      metadata: {
        generated_at: timestamp,
        generated_by: user.email,
        app_version: 'Fleet IQ v1.0',
        purpose: 'Pre-Trae Migration Baseline',
      },
      summary: {
        total_vehicles: counts.vehicles.total,
        active_maintenance_plans: counts.maintenance_plans.active,
        open_work_orders: counts.work_orders.open,
        overdue_work_orders: counts.work_orders.overdue,
        open_critical_defects: counts.prestart_defects.open_critical,
        red_risk_workers: counts.worker_risk.red,
      },
      counts,
      kpis,
      duration_ms: Date.now() - startTime,
    };

    // Store snapshot as JSON
    const snapshotJson = JSON.stringify(snapshot, null, 2);
    const filename = `fleet-health-snapshot-${timestamp.replace(/:/g, '-').split('.')[0]}.json`;

    // Upload to storage
    const blob = new Blob([snapshotJson], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    
    const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const fileUrl = uploadResponse.file_url;

    // Log the snapshot generation
    await base44.asServiceRole.entities.AlertLog.create({
      alert_type: 'ScheduledReport',
      sent_at: timestamp,
      recipients: user.email,
      subject: `Fleet Health Snapshot Generated: ${filename}`,
      related_entity_type: 'HealthSnapshot',
      related_entity_id: filename,
      status: 'Success',
    });

    await logAutomationRun(base44, 'generateFleetHealthSnapshot', 'Success', {
      filename,
      vehicles: counts.vehicles.total,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[HealthSnapshot] Generated: ${filename}`);

    return Response.json({
      success: true,
      snapshot,
      file_url: fileUrl,
      filename,
      message: 'Fleet health snapshot generated successfully',
    });

  } catch (error) {
    console.error('Generate health snapshot error:', error);
    
    const base44 = createClientFromRequest(req);
    await logAutomationRun(base44, 'generateFleetHealthSnapshot', 'Failed', {
      error: error.message,
      duration_ms: Date.now() - startTime,
    });
    
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});