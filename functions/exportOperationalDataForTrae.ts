import { hasPermission } from './checkPermissions.js';
import { getUserFromRequest } from './services/auth.ts';
import { listDowntime, listUsage, listPrestarts, listDefects, listIncidents, listFuelTransactions } from './services/repositories.ts';

/**
 * Export Operational Data for Trae Migration
 * Includes: Downtime, Usage, Prestarts, Defects, Incidents, Fuel Transactions
 * 
 * READY FOR TRAE BACKEND – v1 export contract. Do not change field names without versioning.
 */
Deno.serve(async (req) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only FleetAdmin can export
    if (!hasPermission(user, 'createMaintenanceTemplate')) {
      return Response.json({ 
        error: 'Forbidden: Only FleetAdmin can export data',
        yourRole: user.fleet_role || 'None'
      }, { status: 403 });
    }

    const body = await req.json();
    const { 
      entityType, // "downtime" | "usage" | "prestarts" | "defects" | "incidents" | "fuelTransactions"
      offset = 0, 
      limit = 100,
      dateRangeStart = null,
      dateRangeEnd = null,
      vehicleId = null,
    } = body;

    let data = [];
    let total = 0;

    switch (entityType) {
      case 'downtime': {
        const { total: dTotal, rows } = await listDowntime(vehicleId, dateRangeStart, dateRangeEnd, offset, limit);
        total = dTotal;
        data = rows.map(e => ({
          id: e.id,
          vehicle_id: e.vehicle_id,
          hire_provider_id: e.hire_provider_id,
          start_datetime: e.start_datetime,
          end_datetime: e.end_datetime,
          downtime_hours: e.downtime_hours,
          reason: e.reason,
          cause_category: e.cause_category,
          caused_by: e.caused_by,
          chargeable_to: e.chargeable_to,
          stand_down_expected: e.stand_down_expected,
          stand_down_confirmed: e.stand_down_confirmed,
          linked_service_id: e.linked_service_id,
          linked_work_order_id: e.linked_work_order_id,
          created_date: e.created_date,
        }));
        break;
      }

      case 'usage': {
        const { total: uTotal, rows } = await listUsage(vehicleId, dateRangeStart, dateRangeEnd, offset, limit);
        total = uTotal;
        data = rows.map(r => ({
          id: r.id,
          vehicle_id: r.vehicle_id,
          usage_date: r.usage_date,
          shifts_count: r.shifts_count,
          shift_type: r.shift_type,
          km_travelled: r.km_travelled,
          jobs_count: r.jobs_count,
          primary_job_number: r.primary_job_number,
          project_code: r.project_code,
          source: r.source,
          is_offline: r.is_offline,
          offline_reason: r.offline_reason,
          ownership_type_snapshot: r.ownership_type_snapshot,
          hire_provider_id_snapshot: r.hire_provider_id_snapshot,
          created_date: r.created_date,
        }));
        break;
      }

      case 'prestarts': {
        const { total: pTotal, rows } = await listPrestarts(vehicleId, dateRangeStart, dateRangeEnd, offset, limit);
        total = pTotal;
        data = rows.map(p => ({
          id: p.id,
          vehicle_id: p.vehicle_id,
          prestart_type: p.prestart_type,
          prestart_datetime: p.prestart_datetime,
          worker_name: p.worker_name,
          worker_external_id: p.worker_external_id,
          client_name: p.client_name,
          project_name: p.project_name,
          project_code: p.project_code,
          odometer_km: p.odometer_km,
          odometer_source: p.odometer_source,
          odometer_confidence: p.odometer_confidence,
          overall_result: p.overall_result,
          defect_count: p.defect_count,
          shift_type: p.shift_type,
          assignar_form_id: p.assignar_form_id,
          assignar_prestart_id: p.assignar_prestart_id,
          created_date: p.created_date,
        }));
        break;
      }

      case 'defects': {
        const { total: dfTotal, rows } = await listDefects(vehicleId, dateRangeStart, dateRangeEnd, offset, limit);
        total = dfTotal;
        data = rows.map(d => ({
          id: d.id,
          prestart_id: d.prestart_id,
          vehicle_id: d.vehicle_id,
          defect_description: d.defect_description,
          severity: d.severity,
          status: d.status,
          reported_at: d.reported_at,
          closed_at: d.closed_at,
          linked_service_id: d.linked_service_id,
          created_date: d.created_date,
        }));
        break;
      }

      case 'incidents': {
        const { total: inTotal, rows } = await listIncidents(vehicleId, dateRangeStart, dateRangeEnd, offset, limit);
        total = inTotal;
        data = rows.map(i => ({
          id: i.id,
          incident_datetime: i.incident_datetime,
          vehicle_id: i.vehicle_id,
          driver_name: i.driver_name,
          driver_external_id: i.driver_external_id,
          incident_type: i.incident_type,
          severity: i.severity,
          description: i.description,
          location: i.location,
          project_code: i.project_code,
          client_name: i.client_name,
          injuries_reported: i.injuries_reported,
          damage_cost: i.damage_cost,
          hvnl_breach_type: i.hvnl_breach_type,
          investigation_status: i.investigation_status,
          status: i.status,
          created_date: i.created_date,
        }));
        break;
      }

      case 'fuelTransactions': {
        const { total: fTotal, rows } = await listFuelTransactions(vehicleId, dateRangeStart, dateRangeEnd, offset, limit);
        total = fTotal;
        data = rows.map(t => ({
          id: t.id,
          vehicle_id: t.vehicle_id,
          transaction_datetime: t.transaction_datetime,
          litres: t.litres,
          total_cost: t.total_cost,
          unit_price: t.unit_price,
          site_location: t.site_location,
          fuel_type: t.fuel_type,
          card_number: t.card_number,
          supplier_name: t.supplier_name,
          source: t.source,
          source_reference: t.source_reference,
          ownership_type_snapshot: t.ownership_type_snapshot,
          hire_provider_id_snapshot: t.hire_provider_id_snapshot,
          odometer_at_fill: t.odometer_at_fill,
          project_code: t.project_code,
          created_date: t.created_date,
        }));
        break;
      }

      default:
        return Response.json({
          error: 'Invalid entityType. Must be: downtime, usage, prestarts, defects, incidents, or fuelTransactions',
        }, { status: 400 });
    }

    return Response.json({
      success: true,
      entityType,
      data,
      pagination: {
        offset,
        limit,
        returned: data.length,
        total,
        hasMore: (offset + limit) < total,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('exportOperationalDataForTrae error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});
