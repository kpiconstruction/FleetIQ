const { query } = require('../db');

async function listVehicles(stateFilter, ownershipFilter, offset, limit) {
  const whereParts = [];
  const params = [];
  if (stateFilter) { whereParts.push('state = ?'); params.push(stateFilter); }
  if (ownershipFilter) { whereParts.push('ownership_type = ?'); params.push(ownershipFilter); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const totalRows = await query(`SELECT COUNT(*) AS c FROM Vehicle ${where}`, params);
  const total = Number(totalRows[0] && totalRows[0].c ? totalRows[0].c : 0);
  const rows = await query(`SELECT * FROM Vehicle ${where} ORDER BY asset_code ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

async function listMaintenance(entityType, vehicleId, dateStart, dateEnd, offset, limit) {
  if (entityType === 'templates') {
    const totalRows = await query(`SELECT COUNT(*) AS c FROM MaintenanceTemplate`);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM MaintenanceTemplate ORDER BY id ASC LIMIT ? OFFSET ?`, [limit, offset]);
    return { total, rows };
  }
  if (entityType === 'plans') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM MaintenancePlan ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM MaintenancePlan ${where} ORDER BY updated_date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  if (entityType === 'workOrders') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    if (dateStart) { whereParts.push('raised_datetime >= ?'); params.push(dateStart); }
    if (dateEnd) { whereParts.push('raised_datetime <= ?'); params.push(dateEnd); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM MaintenanceWorkOrder ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM MaintenanceWorkOrder ${where} ORDER BY raised_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  if (entityType === 'serviceRecords') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    if (dateStart) { whereParts.push('service_date >= ?'); params.push(dateStart); }
    if (dateEnd) { whereParts.push('service_date <= ?'); params.push(dateEnd); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM ServiceRecord ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM ServiceRecord ${where} ORDER BY service_date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  return { total: 0, rows: [] };
}

async function listOperational(entityType, vehicleId, dateStart, dateEnd, offset, limit) {
  if (entityType === 'downtime') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    if (dateStart) { whereParts.push('start_datetime >= ?'); params.push(dateStart); }
    if (dateEnd) { whereParts.push('start_datetime <= ?'); params.push(dateEnd); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM AssetDowntimeEvent ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM AssetDowntimeEvent ${where} ORDER BY start_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  if (entityType === 'usage') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    if (dateStart) { whereParts.push('usage_date >= ?'); params.push(dateStart); }
    if (dateEnd) { whereParts.push('usage_date <= ?'); params.push(dateEnd); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM UsageRecord ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM UsageRecord ${where} ORDER BY usage_date DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  if (entityType === 'prestarts') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    if (dateStart) { whereParts.push('prestart_datetime >= ?'); params.push(dateStart); }
    if (dateEnd) { whereParts.push('prestart_datetime <= ?'); params.push(dateEnd); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM PrestartCheck ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM PrestartCheck ${where} ORDER BY prestart_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  if (entityType === 'defects') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    if (dateStart) { whereParts.push('reported_at >= ?'); params.push(dateStart); }
    if (dateEnd) { whereParts.push('reported_at <= ?'); params.push(dateEnd); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM PrestartDefect ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM PrestartDefect ${where} ORDER BY reported_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  if (entityType === 'incidents') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    if (dateStart) { whereParts.push('incident_datetime >= ?'); params.push(dateStart); }
    if (dateEnd) { whereParts.push('incident_datetime <= ?'); params.push(dateEnd); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM IncidentRecord ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM IncidentRecord ${where} ORDER BY incident_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  if (entityType === 'fuelTransactions') {
    const whereParts = [];
    const params = [];
    if (vehicleId) { whereParts.push('vehicle_id = ?'); params.push(vehicleId); }
    if (dateStart) { whereParts.push('transaction_datetime >= ?'); params.push(dateStart); }
    if (dateEnd) { whereParts.push('transaction_datetime <= ?'); params.push(dateEnd); }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const totalRows = await query(`SELECT COUNT(*) AS c FROM FuelTransaction ${where}`, params);
    const total = Number(totalRows[0]?.c || 0);
    const rows = await query(`SELECT * FROM FuelTransaction ${where} ORDER BY transaction_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  return { total: 0, rows: [] };
}

async function listWorkerRisk(riskLevel, offset, limit) {
  const whereParts = [];
  const params = [];
  if (riskLevel) { whereParts.push('current_risk_level = ?'); params.push(riskLevel); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const totalRows = await query(`SELECT COUNT(*) AS c FROM WorkerRiskStatus ${where}`, params);
  const total = Number(totalRows[0]?.c || 0);
  const rows = await query(`SELECT * FROM WorkerRiskStatus ${where} ORDER BY last_updated_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

function registerExportsRoutes(app) {
  app.post('/exports/vehicles', async (req, res) => {
    try {
      const body = req.body || {};
      const offset = Number(body.offset || 0);
      const limit = Number(body.limit || 100);
      const stateFilter = body.stateFilter || null;
      const ownershipFilter = body.ownershipFilter || null;
      const { total, rows } = await listVehicles(stateFilter, ownershipFilter, offset, limit);
      const data = rows;
      return res.send({ success: true, data, pagination: { offset, limit, returned: data.length, total, hasMore: offset + limit < total }, timestamp: new Date().toISOString() });
    } catch (err) {
      return res.status(500).send({ success: false, error: err.message });
    }
  });

  app.post('/exports/maintenance', async (req, res) => {
    try {
      const body = req.body || {};
      const offset = Number(body.offset || 0);
      const limit = Number(body.limit || 100);
      const entityType = body.entityType || 'templates';
      const vehicleId = body.vehicleId || null;
      const dateRangeStart = body.dateRangeStart || null;
      const dateRangeEnd = body.dateRangeEnd || null;
      const { total, rows } = await listMaintenance(entityType, vehicleId, dateRangeStart, dateRangeEnd, offset, limit);
      const data = rows;
      return res.send({ success: true, entityType, data, pagination: { offset, limit, returned: data.length, total, hasMore: offset + limit < total }, timestamp: new Date().toISOString() });
    } catch (err) {
      return res.status(500).send({ success: false, error: err.message });
    }
  });

  app.post('/exports/operational', async (req, res) => {
    try {
      const body = req.body || {};
      const offset = Number(body.offset || 0);
      const limit = Number(body.limit || 100);
      const entityType = body.entityType || 'downtime';
      const vehicleId = body.vehicleId || null;
      const dateRangeStart = body.dateRangeStart || null;
      const dateRangeEnd = body.dateRangeEnd || null;
      const { total, rows } = await listOperational(entityType, vehicleId, dateRangeStart, dateRangeEnd, offset, limit);
      const data = rows;
      return res.send({ success: true, entityType, data, pagination: { offset, limit, returned: data.length, total, hasMore: offset + limit < total }, timestamp: new Date().toISOString() });
    } catch (err) {
      return res.status(500).send({ success: false, error: err.message });
    }
  });

  app.post('/exports/worker-risk', async (req, res) => {
    try {
      const body = req.body || {};
      const offset = Number(body.offset || 0);
      const limit = Number(body.limit || 100);
      const riskLevelFilter = body.riskLevelFilter || null;
      const { total, rows } = await listWorkerRisk(riskLevelFilter, offset, limit);
      const data = rows;
      return res.send({ success: true, data, pagination: { offset, limit, returned: data.length, total, hasMore: offset + limit < total }, timestamp: new Date().toISOString() });
    } catch (err) {
      return res.status(500).send({ success: false, error: err.message });
    }
  });
}

module.exports = { registerExportsRoutes };
