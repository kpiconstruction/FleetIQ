const { query } = require('../../db');

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
    const rows = await query(`SELECT * FROM MaintenancePlan ${where} ORDER BY updated_date DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
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
    const rows = await query(`SELECT * FROM MaintenanceWorkOrder ${where} ORDER BY raised_datetime DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
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
    const rows = await query(`SELECT * FROM ServiceRecord ${where} ORDER BY service_date DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return { total, rows };
  }
  return { total: 0, rows: [] };
}

module.exports = { listMaintenance };
