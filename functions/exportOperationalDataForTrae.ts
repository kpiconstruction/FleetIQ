import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { hasPermission } from './checkPermissions.js';

/**
 * Export Operational Data for Trae Migration
 * Includes: Downtime, Usage, Prestarts, Defects, Incidents
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
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
      entityType, // "downtime" | "usage" | "prestarts" | "defects" | "incidents"
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
        const query = {};
        if (vehicleId) query.vehicle_id = vehicleId;
        let events = await base44.asServiceRole.entities.AssetDowntimeEvent.filter(query, '-start_datetime', 10000);
        
        if (dateRangeStart || dateRangeEnd) {
          events = events.filter(e => {
            const startDate = new Date(e.start_datetime);
            if (dateRangeStart && startDate < new Date(dateRangeStart)) return false;
            if (dateRangeEnd && startDate > new Date(dateRangeEnd)) return false;
            return true;
          });
        }
        
        total = events.length;
        data = events.slice(offset, offset + limit).map(e => ({
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
        const query = {};
        if (vehicleId) query.vehicle_id = vehicleId;
        let records = await base44.asServiceRole.entities.UsageRecord.filter(query, '-usage_date', 10000);
        
        if (dateRangeStart || dateRangeEnd) {
          records = records.filter(r => {
            const usageDate = new Date(r.usage_date);
            if (dateRangeStart && usageDate < new Date(dateRangeStart)) return false;
            if (dateRangeEnd && usageDate > new Date(dateRangeEnd)) return false;
            return true;
          });
        }
        
        total = records.length;
        data = records.slice(offset, offset + limit).map(r => ({
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
        const query = {};
        if (vehicleId) query.vehicle_id = vehicleId;
        let prestarts = await base44.asServiceRole.entities.PrestartCheck.filter(query, '-prestart_datetime', 10000);
        
        if (dateRangeStart || dateRangeEnd) {
          prestarts = prestarts.filter(p => {
            const prestartDate = new Date(p.prestart_datetime);
            if (dateRangeStart && prestartDate < new Date(dateRangeStart)) return false;
            if (dateRangeEnd && prestartDate > new Date(dateRangeEnd)) return false;
            return true;
          });
        }
        
        total = prestarts.length;
        data = prestarts.slice(offset, offset + limit).map(p => ({
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
        const query = {};
        if (vehicleId) query.vehicle_id = vehicleId;
        let defects = await base44.asServiceRole.entities.PrestartDefect.filter(query, '-reported_at', 10000);
        
        if (dateRangeStart || dateRangeEnd) {
          defects = defects.filter(d => {
            const reportedDate = new Date(d.reported_at);
            if (dateRangeStart && reportedDate < new Date(dateRangeStart)) return false;
            if (dateRangeEnd && reportedDate > new Date(dateRangeEnd)) return false;
            return true;
          });
        }
        
        total = defects.length;
        data = defects.slice(offset, offset + limit).map(d => ({
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
        const query = {};
        if (vehicleId) query.vehicle_id = vehicleId;
        let incidents = await base44.asServiceRole.entities.IncidentRecord.filter(query, '-incident_datetime', 10000);
        
        if (dateRangeStart || dateRangeEnd) {
          incidents = incidents.filter(i => {
            const incidentDate = new Date(i.incident_datetime);
            if (dateRangeStart && incidentDate < new Date(dateRangeStart)) return false;
            if (dateRangeEnd && incidentDate > new Date(dateRangeEnd)) return false;
            return true;
          });
        }
        
        total = incidents.length;
        data = incidents.slice(offset, offset + limit).map(i => ({
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

      default:
        return Response.json({
          error: 'Invalid entityType. Must be: downtime, usage, prestarts, defects, or incidents',
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