import { query, pool } from './mysql.ts';

await query('INSERT INTO Vehicle (asset_code, rego, vin, asset_type, vehicle_function_class, state, status, ownership_type, current_odometer_km, odometer_data_confidence) VALUES (?,?,?,?,?,?,?,?,?,?)', [
  'KPI-TMA-001','ABC123','VIN001','TMA','TMA','VIC','Active','Owned',45000,'High'
]);

await query('INSERT INTO MaintenanceTemplate (name, vehicle_function_class, asset_type, trigger_type, interval_days, priority, hvnl_relevance_flag, active) VALUES (?,?,?,?,?,?,?,?)', [
  'Routine Service','TMA','TMA','TimeBased',90,'Routine',1,1
]);

const [plan] = await query('SELECT id FROM MaintenanceTemplate LIMIT 1');
const [veh] = await query('SELECT id FROM Vehicle LIMIT 1');

await query('INSERT INTO MaintenancePlan (vehicle_id, maintenance_template_id, next_due_date, status) VALUES (?,?,?,?)', [
  veh.id, plan.id, new Date().toISOString(), 'Active'
]);

await query('INSERT INTO MaintenanceWorkOrder (vehicle_id, work_order_type, raised_from, raised_datetime, status, priority) VALUES (?,?,?,?,?,?)', [
  veh.id, 'Scheduled', 'Schedule', new Date().toISOString(), 'Open', 'Routine'
]);

await query('INSERT INTO ServiceRecord (vehicle_id, service_date, service_type, workshop_name, cost_ex_gst, cost_chargeable_to) VALUES (?,?,?,?,?,?)', [
  veh.id, new Date().toISOString(), 'Scheduled', 'KPI Workshop', 0, 'KPI'
]);

await query('INSERT INTO AssetDowntimeEvent (vehicle_id, start_datetime, end_datetime, downtime_hours, reason, cause_category, chargeable_to) VALUES (?,?,?,?,?,?,?)', [
  veh.id, new Date().toISOString(), new Date().toISOString(), 4, 'Service', 'PreventativeService', 'KPI'
]);

await query('INSERT INTO UsageRecord (vehicle_id, usage_date, shifts_count, shift_type) VALUES (?,?,?,?)', [
  veh.id, new Date().toISOString(), 1, 'Day'
]);

const [prestartRes] = await pool.query('INSERT INTO PrestartCheck (vehicle_id, prestart_type, prestart_datetime, worker_name, odometer_km, odometer_source, odometer_confidence, overall_result, defect_count) VALUES (?,?,?,?,?,?,?,?,?)', [
  veh.id, 'Assignar', new Date().toISOString(), 'John Worker', 45010, 'ManualOther', 'Medium', 'Pass', 0
]);
const prestartId = (prestartRes as any).insertId;

await query('INSERT INTO PrestartDefect (prestart_id, vehicle_id, defect_description, severity, status, reported_at) VALUES (?,?,?,?,?,?)', [
  prestartId, veh.id, 'Minor leak', 'Low', 'Closed', new Date().toISOString()
]);

await query('INSERT INTO IncidentRecord (incident_datetime, vehicle_id, driver_name, incident_type, severity, description, status) VALUES (?,?,?,?,?,?,?)', [
  new Date().toISOString(), veh.id, 'Jane Driver', 'Accident', 'Minor', 'Scrape', 'Closed'
]);

await query('INSERT INTO FuelTransaction (vehicle_id, transaction_datetime, litres, total_cost, unit_price, site_location, fuel_type, source) VALUES (?,?,?,?,?,?,?,?)', [
  veh.id, new Date().toISOString(), 60, 120, 2, 'Depot', 'Diesel', 'FuelImport'
]);

await query('INSERT INTO WorkerRiskStatus (worker_name, worker_external_id, current_risk_level, previous_risk_level, risk_score, first_detected_datetime, last_updated_datetime) VALUES (?,?,?,?,?,?,?)', [
  'John Worker', 'W001', 'Green', 'Green', 10, new Date().toISOString(), new Date().toISOString()
]);

console.log('Seed data inserted');
