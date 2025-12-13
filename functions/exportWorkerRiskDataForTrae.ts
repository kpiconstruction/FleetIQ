import { hasPermission } from './checkPermissions.js';
import { getUserFromRequest } from './services/auth.ts';
import { listWorkerRiskStatuses } from './services/repositories.ts';

/**
 * Export Worker Risk Data for Trae Migration
 * Read-only API with paging
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
      offset = 0, 
      limit = 100,
      riskLevelFilter = null,
    } = body;

    const { total, rows } = await listWorkerRiskStatuses(riskLevelFilter, offset, limit);
    const normalizedWorkers = rows.map(w => ({
      id: w.id,
      worker_name: w.worker_name,
      worker_external_id: w.worker_external_id,
      current_risk_level: w.current_risk_level,
      previous_risk_level: w.previous_risk_level,
      risk_score: w.risk_score,
      first_detected_datetime: w.first_detected_datetime,
      last_updated_datetime: w.last_updated_datetime,
      failed_prestarts_90d: w.failed_prestarts_90d,
      critical_defects_90d: w.critical_defects_90d,
      incidents_12m: w.incidents_12m,
      hvnl_incidents_12m: w.hvnl_incidents_12m,
      at_fault_count: w.at_fault_count,
      escalation_sent: w.escalation_sent,
      alert_sent: w.alert_sent,
      created_date: w.created_date,
      updated_date: w.updated_date,
    }));

    return Response.json({
      success: true,
      data: normalizedWorkers,
      pagination: {
        offset,
        limit,
        returned: normalizedWorkers.length,
        total,
        hasMore: (offset + limit) < total,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('exportWorkerRiskDataForTrae error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
    }, { status: 500 });
  }
});
