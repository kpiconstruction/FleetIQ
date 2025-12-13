import { query } from './mysql.ts';

export async function count(table: string, where: string, params: any[]) {
  const rows = await query(`SELECT COUNT(*) AS c FROM ${table} ${where}`, params);
  return Number(rows[0]?.c || 0);
}

export async function listVehicles(state: string | null, ownership: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (state) { whereParts.push('state = ?'); params.push(state); }
  if (ownership) { whereParts.push('ownership_type = ?'); params.push(ownership); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('Vehicle', where, params);
  const rows = await query(`SELECT * FROM Vehicle ${where} ORDER BY asset_code ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listMaintenanceTemplates(offset: number, limit: number) {
  const total = await count('MaintenanceTemplate', '', []);
  const rows = await query(`SELECT * FROM MaintenanceTemplate ORDER BY id ASC LIMIT ? OFFSET ?`, [limit, offset]);
  return { total, rows };
}

export async function listMaintenancePlans(vehicleId: number | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('MaintenancePlan', where, params);
  const rows = await query(`SELECT * FROM MaintenancePlan ${where} ORDER BY updated_date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listWorkOrders(vehicleId: number | null, dateStart: string | null, dateEnd: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  if (dateStart) { whereParts.push('raised_datetime >= ?'); params.push(dateStart); }
  if (dateEnd) { whereParts.push('raised_datetime <= ?'); params.push(dateEnd); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('MaintenanceWorkOrder', where, params);
  const rows = await query(`SELECT * FROM MaintenanceWorkOrder ${where} ORDER BY raised_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listServiceRecords(vehicleId: number | null, dateStart: string | null, dateEnd: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  if (dateStart) { whereParts.push('service_date >= ?'); params.push(dateStart); }
  if (dateEnd) { whereParts.push('service_date <= ?'); params.push(dateEnd); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('ServiceRecord', where, params);
  const rows = await query(`SELECT * FROM ServiceRecord ${where} ORDER BY service_date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listDowntime(vehicleId: number | null, dateStart: string | null, dateEnd: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  if (dateStart) { whereParts.push('start_datetime >= ?'); params.push(dateStart); }
  if (dateEnd) { whereParts.push('start_datetime <= ?'); params.push(dateEnd); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('AssetDowntimeEvent', where, params);
  const rows = await query(`SELECT * FROM AssetDowntimeEvent ${where} ORDER BY start_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listUsage(vehicleId: number | null, dateStart: string | null, dateEnd: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  if (dateStart) { whereParts.push('usage_date >= ?'); params.push(dateStart); }
  if (dateEnd) { whereParts.push('usage_date <= ?'); params.push(dateEnd); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('UsageRecord', where, params);
  const rows = await query(`SELECT * FROM UsageRecord ${where} ORDER BY usage_date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listPrestarts(vehicleId: number | null, dateStart: string | null, dateEnd: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  if (dateStart) { whereParts.push('prestart_datetime >= ?'); params.push(dateStart); }
  if (dateEnd) { whereParts.push('prestart_datetime <= ?'); params.push(dateEnd); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('PrestartCheck', where, params);
  const rows = await query(`SELECT * FROM PrestartCheck ${where} ORDER BY prestart_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listDefects(vehicleId: number | null, dateStart: string | null, dateEnd: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  if (dateStart) { whereParts.push('reported_at >= ?'); params.push(dateStart); }
  if (dateEnd) { whereParts.push('reported_at <= ?'); params.push(dateEnd); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('PrestartDefect', where, params);
  const rows = await query(`SELECT * FROM PrestartDefect ${where} ORDER BY reported_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listIncidents(vehicleId: number | null, dateStart: string | null, dateEnd: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  if (dateStart) { whereParts.push('incident_datetime >= ?'); params.push(dateStart); }
  if (dateEnd) { whereParts.push('incident_datetime <= ?'); params.push(dateEnd); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('IncidentRecord', where, params);
  const rows = await query(`SELECT * FROM IncidentRecord ${where} ORDER BY incident_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listFuelTransactions(vehicleId: number | null, dateStart: string | null, dateEnd: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
  if (dateStart) { whereParts.push('transaction_datetime >= ?'); params.push(dateStart); }
  if (dateEnd) { whereParts.push('transaction_datetime <= ?'); params.push(dateEnd); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('FuelTransaction', where, params);
  const rows = await query(`SELECT * FROM FuelTransaction ${where} ORDER BY transaction_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

export async function listWorkerRiskStatuses(riskLevel: string | null, offset: number, limit: number) {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (riskLevel) { whereParts.push('current_risk_level = ?'); params.push(riskLevel); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const total = await count('WorkerRiskStatus', where, params);
  const rows = await query(`SELECT * FROM WorkerRiskStatus ${where} ORDER BY last_updated_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}
