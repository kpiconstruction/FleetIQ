const { listVehicles } = require('../services/exports/vehicles');
const { listMaintenance } = require('../services/exports/maintenance');
const { listOperational } = require('../services/exports/operational');
const { listWorkerRisk } = require('../services/exports/workerRisk');

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
