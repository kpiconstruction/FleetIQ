const { query } = require('../db');

function normalizeVehicles(rows) {
  return rows.map(v => ({
    id: v.id,
    asset_code: v.asset_code,
    rego: v.rego,
    vin: v.vin,
    asset_type: v.asset_type,
    vehicle_function_class: v.vehicle_function_class,
    tma_variant: v.tma_variant,
    make: v.make,
    model: v.model,
    year: v.year,
    state: v.state,
    primary_depot: v.primary_depot,
    status: v.status,
    in_service_date: v.in_service_date,
    out_of_service_date: v.out_of_service_date,
    ownership_type: v.ownership_type,
    hire_provider_id: v.hire_provider_id,
    contract_id: v.contract_id,
    current_odometer_km: v.current_odometer_km,
    odometer_data_confidence: v.odometer_data_confidence,
    assignar_tracked: v.assignar_tracked,
    assignar_asset_id: v.assignar_asset_id,
    created_date: v.created_date,
    updated_date: v.updated_date
  }));
}

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

function registerExportsRoutes(app) {
  app.post('/exports/vehicles', async (req, res) => {
    try {
      const body = req.body || {};
      const offset = Number(body.offset || 0);
      const limit = Number(body.limit || 100);
      const stateFilter = body.stateFilter || null;
      const ownershipFilter = body.ownershipFilter || null;

      const { total, rows } = await listVehicles(stateFilter, ownershipFilter, offset, limit);
      const data = normalizeVehicles(rows);

      return res.send({
        success: true,
        data,
        pagination: {
          offset,
          limit,
          returned: data.length,
          total,
          hasMore: offset + limit < total
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      return res.status(500).send({ success: false, error: err.message });
    }
  });

  app.post('/exports/maintenance', async (req, res) => {
    return res.status(501).send({ success: false, error: 'Not implemented' });
  });

  app.post('/exports/operational', async (req, res) => {
    return res.status(501).send({ success: false, error: 'Not implemented' });
  });

  app.post('/exports/worker-risk', async (req, res) => {
    return res.status(501).send({ success: false, error: 'Not implemented' });
  });
}

module.exports = { registerExportsRoutes };
