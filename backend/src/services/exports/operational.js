const { query } = require('../../db');

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
    const rows = await query(`SELECT * FROM AssetDowntimeEvent ${where} ORDER BY start_datetime DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
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
    const rows = await query(`SELECT * FROM UsageRecord ${where} ORDER BY usage_date DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
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
    const rows = await query(`SELECT * FROM PrestartCheck ${where} ORDER BY prestart_datetime DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
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
    const rows = await query(`SELECT * FROM PrestartDefect ${where} ORDER BY reported_at DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
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
    const rows = await query(`SELECT * FROM IncidentRecord ${where} ORDER BY incident_datetime DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
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
    const rows = await query(`SELECT * FROM FuelTransaction ${where} ORDER BY transaction_datetime DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  return { total: 0, rows: [] };
}

module.exports = { listOperational };
