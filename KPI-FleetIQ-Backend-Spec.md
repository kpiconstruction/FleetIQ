# KPI – Fleet IQ Backend Specification (Freeze for Trae Rebuild)

Version: 1.0 (Base44 baseline – ready for Trae)

## 1. Scope

KPI – Fleet IQ is the fleet maintenance, utilisation, and HVNL risk platform for:

- **Assets:** TMAs, pod trucks, traffic utes, plant, corporate vehicles
- **Ownership:** Owned vs ContractHire vs DayHire
- **Signals:** Prestarts (Assignar), defects, incidents, service history, downtime, usage, fuel, worker risk

This spec defines the **data model, business rules, RBAC, automations, imports and export contracts** that Trae must reproduce.

---

## 2. Core Entities (Canonical Model)

### 2.1 Vehicle

Key fields:

- `id`
- `asset_code` (required, unique)
- `rego`, `vin`
- `asset_type` (TMA, Pod Truck, Traffic Ute, Plant, …)
- `vehicle_function_class` (CorporateCar, TrafficUte, VMSUte, PodTruckCar, PodTruckTruck, TMA)
- `tma_variant` (Blades, Silke, Julietta, Scorpion, Other)
- `assignar_tracked` (bool)
- `assignar_asset_id`
- `make`, `model`, `year`
- `state` (VIC, NSW, QLD, …)
- `primary_depot`
- `status` (Active, In Maintenance, Decommissioned)
- `ownership_type` (Owned, ContractHire, DayHire)
- `hire_provider_id`, `contract_id`
- `in_service_date`, `out_of_service_date`
- **Odometer tracking**
  - `current_odometer_km`
  - `odometer_last_prestart_km`
  - `odometer_last_prestart_datetime`
  - `odometer_data_confidence` (High, Medium, Low, Unknown)
- `next_service_due_km`, `next_service_due_date`, `last_service_date`
- `last_prestart_date`, `last_prestart_result`
- `notes`

**Rules:**

- **Single odometer SOT:** All “current odometer” usage must come from the `getBestOdometerSnapshot()` service, not directly from `current_odometer_km`.
- Assignar is considered the canonical external system for usage/prestart, but odometer entries are low-trust (confidence flags matter).

---

### 2.2 ServiceRecord

- `vehicle_id`
- `service_date`
- `odometer_km`
- `engine_hours`
- `service_type` (Scheduled, Unscheduled, Breakdown, Warranty, HireProviderService)
- `workshop_name`, `hire_provider_id`
- `cost_ex_gst`, `labour_cost`, `parts_cost`
- `cost_chargeable_to` (KPI, HireProvider, Client, Shared, Unknown)
- `invoice_number`
- `downtime_start`, `downtime_end`, `downtime_hours`
- `downtime_reason`, `downtime_chargeable_to`, `downtime_billable_flag`
- `hire_credit_reference`
- `notes`, `attachment_url`
- `import_batch_id`, `imported_row_id`
- `source_system` (ExcelLegacy, OdooLegacy, Manual, OCRInvoice)
- `source_reference`

**Critical rules (Owned vs Hire):**

- **Owned fleet**  
  - Default `cost_chargeable_to = KPI` unless overridden.  
  - Any service/repair costs allowed.

- **Hire fleet (ContractHire / DayHire) – Scheduled / Provider services**  
  - If `ownership_type ∈ (ContractHire, DayHire)` AND `service_type ∈ (Scheduled, HireProviderService, Warranty)` AND no explicit override:  
    - `cost_ex_gst = 0`, `labour_cost = 0`, `parts_cost = 0`  
    - `cost_chargeable_to = HireProvider`
    - `downtime_chargeable_to` defaults to `HireProvider`.

- **Hire fleet – damage / fault (KPI at fault)**  
  - For `work_order_type ∈ (Corrective, DefectRepair)` with `cost_chargeable_to = KPI`:  
    - Non-zero costs allowed – these hit KPI’s P&L as repair of a hire asset.
  - If `cost_chargeable_to = HireProvider` on hire fleet: enforce zero costs.
  - If `cost_chargeable_to = Client` or `Shared`: costs allowed but must be distinguishable in reporting.

All cost attribution rules are centralised in a **maintenance cost rules service**, not scattered.

---

### 2.3 AssetDowntimeEvent

- `vehicle_id`, `hire_provider_id`
- `start_datetime`, `end_datetime`, `downtime_hours`
- `reason` (Service, Breakdown, Accident, ClientHold, AwaitingParts, …)
- `cause_category` (PreventativeService, CorrectiveRepair, HireProviderDelay, PartsDelay, IncidentRepair, Other)
- `caused_by` (KPI, HireProvider, Client, Unknown)
- `chargeable_to` (KPI, HireProvider, Client, Shared)
- `stand_down_expected`, `stand_down_confirmed`, `stand_down_credit_ref`
- `linked_service_id`, `linked_work_order_id`, `linked_project_code`
- `notes`

Downtime is used for utilisation, provider performance, and stand-down/credit analysis.

---

### 2.4 UsageRecord

- `vehicle_id`
- `usage_date`
- **Primary utilisation metric:** `shifts_count` (not hours)
- `shift_type` (Day, Night, Split, Other)
- Optional: `total_hours`, `km_travelled`, `jobs_count`
- `primary_job_number`, `project_code`
- `source` (Assignar, Manual), `source_record_id`
- `is_offline`, `offline_reason`
- `ownership_type_snapshot`, `hire_provider_id_snapshot`
- `estimated_hire_cost`
- `notes`

**Key point:** KPI manages utilisation in **shifts**, not hours. Hours are secondary.

---

### 2.5 PrestartCheck & PrestartDefect

**PrestartCheck**

- `vehicle_id`, `prestart_type`
- `assignar_form_id`, `assignar_prestart_id`
- `prestart_datetime`
- `client_name`, `project_name`, `project_code`
- `odometer_km`, `odometer_source` (AssignarManual, Telematics, ManualOther)
- `odometer_confidence` (High/Medium/Low/Unknown)
- `next_service_km`
- `shift_type`
- `worker_name`, `worker_external_id`
- `overall_result` (Pass/Fail)
- `defect_count`
- `location_text`
- `created_source` (Assignar, Manual)

**PrestartDefect**

- `prestart_id`, `prestart_item_id`
- `vehicle_id`
- `defect_description`
- `severity` (Low, Medium, High, Critical)
- `status` (Open, In Repair, Closed, Deferred)
- `reported_at`, `closed_at`
- `rectification_notes`
- `linked_service_id`

Tied to work orders via `MaintenanceWorkOrder.linked_prestart_defect_id`.

---

### 2.6 MaintenanceTemplate & MaintenancePlan

**MaintenanceTemplate**

- `name`
- `vehicle_function_class`, `asset_type`
- `trigger_type` (TimeBased, OdometerBased, HoursBased, Hybrid)
- `interval_days`, `interval_km`, `interval_hours`
- `priority` (Routine, Major, SafetyCritical)
- `task_summary`, `checklist_items[]`
- `hvnl_relevance_flag`
- `active`

**MaintenancePlan**

- `vehicle_id`, `maintenance_template_id`
- `last_completed_date`, `last_completed_odometer_km`
- `next_due_date`, `next_due_odometer_km`
- `status` (Active, Suspended)
- `notes`

**Derived fields** are calculated centrally (not stored) via `getMaintenancePlanSchedule`:  

- `next_due_date`, `next_due_odometer_km`
- `status` (OnTrack, DueSoon, Overdue)
- `days_until_due`, `days_overdue`
- `is_overdue`, `is_due_soon`
- `is_hvnl_critical`
- plus odometer snapshot (`current_odometer_km`, `odometer_source`, `odometer_confidence`)

---

### 2.7 MaintenanceWorkOrder

- `vehicle_id`
- `maintenance_plan_id` (nullable)
- `maintenance_template_id` (nullable)
- `linked_prestart_defect_id` (nullable)
- `linked_incident_id` (nullable)
- `work_order_type` (Scheduled, Corrective, DefectRepair)
- `raised_from` (Schedule, PrestartDefect, Incident, Manual)
- `raised_datetime`
- `due_date`
- `assigned_to_workshop_name`, `assigned_to_hire_provider_id`
- `status` (Open, InProgress, Completed, Cancelled)
- `priority` (Routine, Major, SafetyCritical)
- `odometer_at_raise`
- `linked_service_record_id`
- `purchase_order_number`
- `completion_confirmed_by_user_id`, `completion_confirmed_at`
- `confirmed_downtime_hours`
- `completion_notes`
- `notes_internal`, `notes_for_provider`

**Work order rules:**

- **Scheduled WOs from plans**:  
  - `work_order_type = Scheduled`, `raised_from = Schedule`  
  - Must have `maintenance_plan_id` and `maintenance_template_id`.  

- **Ad-hoc/corrective/defect WOs**:  
  - `maintenance_plan_id` / `maintenance_template_id` optional.  
  - Can be raised from PrestartDefect (`linked_prestart_defect_id`) or Incident (`linked_incident_id`) or Manual.  

- **PO logic:**  
  - For **owned fleet**, `purchase_order_number` stored on completion.  
  - For **hire fleet**, PO is still captured for KPI-payable repairs.

---

### 2.8 IncidentRecord & WorkerRiskStatus

**IncidentRecord**

- `incident_datetime`
- `vehicle_id` (nullable)
- `driver_name`, `driver_external_id`
- `incident_type` (Accident, Near Miss, Property Damage, Injury, HVNL Breach, Environmental, Other)
- `severity` (Minor, Moderate, Serious, Critical)
- `description`, `location`, `project_code`, `client_name`
- `injuries_reported`
- `damage_cost`
- `hvnl_breach_type`
- `reported_by`
- `investigation_status` (Pending, In Progress, Completed, Closed)
- `corrective_actions`
- `attachments[]`
- `notified_authorities`
- `status` (Open, Under Investigation, Resolved, Closed)

**WorkerRiskStatus**

- `worker_name`, `worker_external_id`
- `current_risk_level` (Green, Amber, Red)
- `previous_risk_level`
- `first_detected_datetime`, `last_updated_datetime`
- `risk_score`
- `failed_prestarts_90d`, `critical_defects_90d`
- `incidents_12m`, `hvnl_incidents_12m`, `at_fault_count`
- `escalation_sent`, `alert_sent`
- `notes`

---

### 2.9 FuelTransaction

- `vehicle_id`
- `transaction_datetime`
- `litres`
- `total_cost`
- `price_per_litre`
- `site_location`
- `fuel_type`
- `card_provider`
- `card_number_masked` (if stored)
- `ownership_type_snapshot`, `hire_provider_id_snapshot`
- `source` (FuelImport, Manual)
- `import_batch_id`, `imported_row_id`
- `notes`

Fuel comes from **CSV/Excel fuel card exports**, not photo receipts.

---

### 2.10 Config & Audit

**NotificationConfig**  
Key–value email/settings store. All alerts and reports resolve recipients from here.

**AutomationConfig**  
Kill switches and thresholds for automations (plan auto-WOs, defect auto-WOs, incident auto-WOs, alerts, reports).

**AlertLog**  
Audit of all automated alerts and scheduled actions (type, datetime, recipients, success/fail, related entity).

**User**  
Has `fleet_role` = FleetAdmin, WorkshopOps, StateOps, Viewer.

---

## 3. Core Business Logic

### 3.1 Centralised Odometer Logic

`getBestOdometerSnapshot(vehicle)`:

- Prefer latest `PrestartCheck.odometer_km`.  
- Apply sanity checks (backwards movement, huge jumps).  
- Fall back to `Vehicle.current_odometer_km` if prestart data is low-confidence.  
- Returns: `current_odometer_km`, `odometer_source`, `odometer_confidence`.  

All maintenance plan calculations use this helper.

---

### 3.2 Plan Scheduling Logic

`getMaintenancePlanSchedule`:

- For each `MaintenancePlan + Vehicle + Template`, computes derived fields and HVNL flags.  
- Used by Planner, Operational Control, Overview dashboards and alerts.  
- Hybrid triggers: a plan is overdue if **either** time or odometer threshold is exceeded.

---

### 3.3 Preventative vs Corrective vs Defect Repair

Based on `MaintenanceWorkOrder.work_order_type`:

- Scheduled → Preventative  
- Corrective → Corrective  
- DefectRepair → Defect repair  

Dashboards, cost and downtime aggregates classify by this dimension.

---

### 3.4 Owned vs Hire Cost Attribution

All cost aggregation (KPI maintenance cost, hire provider performance, cost per shift, etc.) **must**:

- Exclude hire scheduled services where `cost_chargeable_to = HireProvider`.  
- Include KPI-at-fault repairs on hire vehicles (`ownership_type` is hire and `cost_chargeable_to = KPI`).  
- Treat `Client` / `Shared` as separate categories.

Cost rules are enforced on **write** and respected in **aggregates**.

---

## 4. RBAC

Roles:

- `FleetAdmin` – full admin for fleet config, imports, exports, automation settings.  
- `WorkshopOps` – manage work orders, confirm services, assist with imports mapping (not commit).  
- `StateOps` – view dashboards, vehicles, defects, incidents; limited updates.  
- `Viewer` – read-only.

Key permissions:

- Templates & Plans CRUD → FleetAdmin  
- WorkOrder create/update → FleetAdmin, WorkshopOps  
- ServiceHistoryMigration / FuelImport **commit** → FleetAdmin only  
- NotificationConfig, AutomationConfig → FleetAdmin only  
- Export-for-Trae endpoints → FleetAdmin only  

Permissions must be enforced **server-side** as well as in UI.

---

## 5. Automations & Alerts

Controlled via `AutomationConfig` + `NotificationConfig` + `AlertLog`.

Examples (all implemented):

- **autoCreatePlanWorkOrders** – auto WOs from upcoming plans (within configurable days; one open WO per plan).  
- **autoCreateDefectWorkOrder** – auto WOs from High/Critical open defects (with no linked WO).  
- **autoCreateIncidentWorkOrder** (optional) – auto WOs from Serious/Critical incidents.  
- **autoAlertMaintenanceStatus** – emails when plans transition to DueSoon/Overdue.  
- **autoAlertWorkOrders** – daily summary for overdue WOs per state.  
- **autoAlertOpenDefects** – escalation for High/Critical defects that stay open too long.  
- **Worker risk alerts** – when WorkerRiskStatus moves to Amber/Red.  
- **Monthly HVNL/Maintenance reports** – scheduled PDF/report generation and email.

Each automation:

- Checks its relevant `AutomationConfig` flags.  
- Uses `NotificationConfig` for recipients.  
- Writes to `AlertLog`.

---

## 6. Imports

### 6.1 ServiceHistoryMigration

- Wizard: Upload → Map → Validate → Review/Resolve → Commit.  
- Entities: `ImportBatch`, `ImportedServiceRow`.  

Commit rules:

- **Only** commit rows with `resolution_status = Ready`.  
- **Block** commit if any rows in `Unmapped`, `VehicleNotFound`, `InvalidData`, `Duplicate`.  
- `Ignored` rows are kept but not committed.  
- Errors during commit mark rows as `InvalidData` with notes.  
- Commit restricted to `FleetAdmin`.

### 6.2 FuelImport

- Wizard: Upload CSV/Excel from fuel card provider → Map → Validate → Resolve → Commit.  
- Entities: `FuelImportBatch`, `ImportedFuelRow`.  
- Same commit rules as ServiceHistoryMigration.  
- Creates `FuelTransaction`.

No fuel OCR in UI – fuel comes from file imports only.

### 6.3 Service invoice OCR (optional)

- `processServiceInvoiceUpload` may exist for OCR’ing workshop invoices into draft `ServiceRecord`.  
- Any OCR-generated entries must still pass the same cost rule enforcement and require human confirmation.

---

## 7. Export Contracts for Trae

All exports require `FleetAdmin` and are considered **v1 stable contracts**.

### 7.1 `exportVehiclesForTrae`

Returns:

- Vehicles with core fields + odometer snapshot (`current_odometer_km`, `odometer_source`, `odometer_confidence`).  
- Optional filters: state, ownership_type, asset_type, function_class.

### 7.2 `exportMaintenanceDataForTrae`

Returns:

- `maintenanceTemplates`  
- `maintenancePlans` + derived scheduling fields  
- `maintenanceWorkOrders` (incl. `linked_prestart_defect_id`, `linked_incident_id`, `purchase_order_number`)  
- `serviceRecords` (incl. `cost_chargeable_to`, cost breakdown, downtime linkages)

### 7.3 `exportOperationalDataForTrae`

Returns:

- `assetDowntimeEvents`  
- `usageRecords` (shift-based)  
- `prestartChecks`  
- `prestartDefects`  
- `incidentRecords`  
- `fuelTransactions`

All with filters for date range, state, ownership, provider.

### 7.4 `exportWorkerRiskDataForTrae`

Returns:

- `workerRiskStatuses` with all risk metrics and timestamps.

All export endpoints are paginated; field names must not change without versioning.

---

## 8. Migration Notes for Trae

- Use this spec as the **source of truth**; Base44 implementation is the reference, not the new authority.  
- Rebuild backend tables and services to match this model and behaviour.  
- Frontend can change technology, but API contracts and rules should remain consistent until v2.

