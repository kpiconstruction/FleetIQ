const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { listVehicles } = require('../src/services/exports/vehicles');
const { listMaintenance } = require('../src/services/exports/maintenance');
const { listOperational } = require('../src/services/exports/operational');
const { listWorkerRisk } = require('../src/services/exports/workerRisk');

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function stableKeys(obj, keys) {
  const o = {};
  for (const k of keys) o[k] = obj[k] ?? null;
  return o;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function writeJsonOrdered(filePath, rows, keys) {
  const ordered = rows.map(r => stableKeys(r, keys));
  const json = JSON.stringify(ordered);
  fs.writeFileSync(filePath, json);
  const stats = fs.statSync(filePath);
  return { count: ordered.length, bytes: stats.size, sha256: sha256(Buffer.from(json)) };
}

function gateVehicles(rows) {
  const seenVin = new Set();
  const seenRego = new Set();
  for (const r of rows) {
    const vin = (r.vin || '').trim();
    const rego = (r.rego || '').trim();
    if (vin) {
      if (seenVin.has(vin)) throw new Error('Duplicate VIN detected');
      seenVin.add(vin);
    } else if (rego) {
      if (seenRego.has(rego)) throw new Error('Duplicate registration detected');
      seenRego.add(rego);
    }
    const now = Date.now();
    const skew = 60000;
    const updated = r.updated_date ? Date.parse(r.updated_date) : null;
    if (updated && updated > now + skew) throw new Error('Future updated_date detected');
  }
}

async function run() {
  const outDir = path.resolve(__dirname, `../exports/run-${ts()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = { timestamp: new Date().toISOString(), files: [] };

  const { rows: vehRows } = await listVehicles(null, null, 0, 1000000);
  gateVehicles(vehRows);
  const vehKeys = [
    'id','asset_code','rego','vin','asset_type','vehicle_function_class','tma_variant','make','model','year','state','primary_depot','status','in_service_date','out_of_service_date','ownership_type','hire_provider_id','contract_id','current_odometer_km','odometer_data_confidence','assignar_tracked','assignar_asset_id','created_date','updated_date'
  ];
  const vehMeta = await writeJsonOrdered(path.join(outDir, 'vehicles.json'), vehRows, vehKeys);
  manifest.files.push({ name: 'vehicles.json', ...vehMeta });

  const manPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manPath, JSON.stringify(manifest));

  console.log(outDir);
}

run().catch(err => { console.error(err.message); process.exit(1); });
