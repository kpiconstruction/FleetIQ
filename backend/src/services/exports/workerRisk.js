const { query } = require('../../db');

async function listWorkerRisk(riskLevel, offset, limit) {
  const whereParts = [];
  const params = [];
  if (riskLevel) { whereParts.push('current_risk_level = ?'); params.push(riskLevel); }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const totalRows = await query(`SELECT COUNT(*) AS c FROM WorkerRiskStatus ${where}`, params);
  const total = Number(totalRows[0]?.c || 0);
  const rows = await query(`SELECT * FROM WorkerRiskStatus ${where} ORDER BY last_updated_datetime DESC, id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}

module.exports = { listWorkerRisk };
