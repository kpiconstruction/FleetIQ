const { query } = require('../../db');

async function listVehicles(stateFilter, ownershipFilter, offset, limit) {
  const whereParts = [];
  const params = [];
  if (stateFilter) { whereParts.push('state = ?'); params.push(stateFilter); }
  if (ownershipFilter) { whereParts.push('ownership_type = ?'); params.push(ownershipFilter); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const totalRows = await query(`SELECT COUNT(*) AS c FROM Vehicle ${where}`, params);
  const total = Number(totalRows[0] && totalRows[0].c ? totalRows[0].c : 0);
  const rows = await query(`SELECT * FROM Vehicle ${where} ORDER BY id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

module.exports = { listVehicles };
