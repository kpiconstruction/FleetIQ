import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { hasPermission } from './checkPermissions.js';

/**
 * Export Maintenance Data for Trae Migration
 * Includes: Templates, Plans, Work Orders, Service Records
 * 
 * READY FOR TRAE BACKEND – v1 export contract. Do not change field names without versioning.
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
      entityType, // "templates" | "plans" | "workOrders" | "serviceRecords"
      offset = 0, 
      limit = 100,
      dateRangeStart = null,
      dateRangeEnd = null,
      vehicleId = null,
    } = body;

    let data = [];
    let total = 0;

    switch (entityType) {
      case 'templates': {
        const templates = await base44.asServiceRole.entities.MaintenanceTemplate.list();
        total = templates.length;
        data = templates.slice(offset, offset + limit).map(t => ({
          id: t.id,
          name: t.name,
          vehicle_function_class: t.vehicle_function_class,
          asset_type: t.asset_type,
          trigger_type: t.trigger_type,
          interval_days: t.interval_days,
          interval_km: t.interval_km,
          interval_hours: t.interval_hours,
          priority: t.priority,
          hvnl_relevance_flag: t.hvnl_relevance_flag,
          task_summary: t.task_summary,
          checklist_items: t.checklist_items,
          active: t.active,
          created_date: t.created_date,
        }));
        break;
      }

      case 'plans': {
        const query = vehicleId ? { vehicle_id: vehicleId } : {};
        const plans = await base44.asServiceRole.entities.MaintenancePlan.filter(query, '-updated_date', 10000);
        total = plans.length;
        data = plans.slice(offset, offset + limit).map(p => ({
          id: p.id,
          vehicle_id: p.vehicle_id,
          maintenance_template_id: p.maintenance_template_id,
          last_completed_date: p.last_completed_date,
          last_completed_odometer_km: p.last_completed_odometer_km,
          next_due_date: p.next_due_date,
          next_due_odometer_km: p.next_due_odometer_km,
          status: p.status,
          created_date: p.created_date,
          updated_date: p.updated_date,
        }));
        break;
      }

      case 'workOrders': {
        const query = {};
        if (vehicleId) query.vehicle_id = vehicleId;
        let workOrders = await base44.asServiceRole.entities.MaintenanceWorkOrder.filter(query, '-raised_datetime', 10000);
        
        // Date filter
        if (dateRangeStart || dateRangeEnd) {
          workOrders = workOrders.filter(wo => {
            const raisedDate = new Date(wo.raised_datetime);
            if (dateRangeStart && raisedDate < new Date(dateRangeStart)) return false;
            if (dateRangeEnd && raisedDate > new Date(dateRangeEnd)) return false;
            return true;
          });
        }
        
        total = workOrders.length;
        data = workOrders.slice(offset, offset + limit).map(wo => ({
          id: wo.id,
          vehicle_id: wo.vehicle_id,
          maintenance_plan_id: wo.maintenance_plan_id,
          maintenance_template_id: wo.maintenance_template_id,
          work_order_type: wo.work_order_type,
          raised_from: wo.raised_from,
          raised_datetime: wo.raised_datetime,
          due_date: wo.due_date,
          status: wo.status,
          priority: wo.priority,
          linked_service_record_id: wo.linked_service_record_id,
          linked_prestart_defect_id: wo.linked_prestart_defect_id,
          linked_incident_id: wo.linked_incident_id,
          assigned_to_workshop_name: wo.assigned_to_workshop_name,
          assigned_to_hire_provider_id: wo.assigned_to_hire_provider_id,
          purchase_order_number: wo.purchase_order_number,
          confirmed_downtime_hours: wo.confirmed_downtime_hours,
          completion_confirmed_by_user_id: wo.completion_confirmed_by_user_id,
          completion_confirmed_at: wo.completion_confirmed_at,
          created_date: wo.created_date,
          updated_date: wo.updated_date,
        }));
        break;
      }

      case 'serviceRecords': {
        const query = {};
        if (vehicleId) query.vehicle_id = vehicleId;
        let services = await base44.asServiceRole.entities.ServiceRecord.filter(query, '-service_date', 10000);
        
        // Date filter
        if (dateRangeStart || dateRangeEnd) {
          services = services.filter(s => {
            const serviceDate = new Date(s.service_date);
            if (dateRangeStart && serviceDate < new Date(dateRangeStart)) return false;
            if (dateRangeEnd && serviceDate > new Date(dateRangeEnd)) return false;
            return true;
          });
        }
        
        total = services.length;
        data = services.slice(offset, offset + limit).map(s => ({
          id: s.id,
          vehicle_id: s.vehicle_id,
          service_date: s.service_date,
          service_type: s.service_type,
          workshop_name: s.workshop_name,
          hire_provider_id: s.hire_provider_id,
          cost_ex_gst: s.cost_ex_gst,
          labour_cost: s.labour_cost,
          parts_cost: s.parts_cost,
          cost_chargeable_to: s.cost_chargeable_to,
          cost_anomaly_flag: s.cost_anomaly_flag,
          cost_anomaly_reason: s.cost_anomaly_reason,
          invoice_number: s.invoice_number,
          odometer_km: s.odometer_km,
          downtime_start: s.downtime_start,
          downtime_end: s.downtime_end,
          downtime_hours: s.downtime_hours,
          downtime_chargeable_to: s.downtime_chargeable_to,
          downtime_billable_flag: s.downtime_billable_flag,
          source_system: s.source_system,
          created_date: s.created_date,
        }));
        break;
      }

      default:
        return Response.json({
          error: 'Invalid entityType. Must be: templates, plans, workOrders, or serviceRecords',
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
    console.error('exportMaintenanceDataForTrae error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});