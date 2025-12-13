# KPI – Fleet IQ

Fleet maintenance, utilisation, and HVNL risk platform for KPI Group’s heavy and light vehicle fleet.

This repository contains the **frozen backend specification and export layer** for the KPI – Fleet IQ application, originally built on Base44 and now being rebuilt with a Trae-backed stack.

---

## Status

- **Current State:** Backend model and behaviour **frozen at v1.0** for Trae migration.
- **Source of Truth:** `docs/KPI-FleetIQ-Backend-Spec.md`
- **Changes Allowed:**
  - Bug fixes and data corrections only.
  - No breaking changes to export contracts without versioning.

---

## Overview

KPI – Fleet IQ consolidates:

- **Asset data** – TMAs, pod trucks, traffic utes, plant, corporate vehicles.
- **Ownership** – Owned vs ContractHire vs DayHire.
- **Signals** – Prestarts (Assignar), defects, incidents, service history, downtime, usage, fuel, worker risk.
- **Compliance** – HVNL-relevant maintenance, worker risk scores, incident history.
- **Costs** – Maintenance and repair costs with explicit attribution (KPI, Hire Provider, Client, Shared).

The implementation in this repo is the **frozen baseline** that Trae must replicate from a data and behaviour point of view.

---

## Core Domains

### Vehicles

Canonical master record for all assets.

Key concepts:

- `ownership_type` – `Owned`, `ContractHire`, `DayHire`
- `vehicle_function_class` – e.g. `TMA`, `PodTruckTruck`, `TrafficUte`, `CorporateCar`
- Odometer tracking:
  - `current_odometer_km`
  - `odometer_last_prestart_km`
  - `odometer_last_prestart_datetime`
  - `odometer_data_confidence`

All consumers must treat **`getBestOdometerSnapshot()`** as the single source of truth for current odometer values. Nothing should directly “trust” the raw `current_odometer_km` alone.

---

### Maintenance & Service

#### ServiceRecord

Tracks services and repairs, including cost and downtime.

Key fields:

- `service_type` – `Scheduled`, `Unscheduled`, `Breakdown`, `Warranty`, `HireProviderService`
- Cost breakdown – `cost_ex_gst`, `labour_cost`, `parts_cost`
- `cost_chargeable_to` – `KPI`, `HireProvider`, `Client`, `Shared`, `Unknown`
- Downtime fields – `downtime_start`, `downtime_end`, `downtime_hours`, `downtime_chargeable_to`

**Critical behaviour:**

- Owned fleet → costs behave as normal (default `cost_chargeable_to = KPI`).
- Hire fleet scheduled / provider services → **no KPI cost**:
  - `cost_ex_gst = 0`, `labour_cost = 0`, `parts_cost = 0`
  - `cost_chargeable_to = HireProvider`
- Hire fleet damage/fault (KPI at fault):
  - Costs allowed only when `cost_chargeable_to` is `KPI` / `Client` / `Shared`.

These rules are centralised in a **maintenance cost rules service** and must not be duplicated ad-hoc.

#### MaintenanceTemplate / MaintenancePlan

- Templates define service logic by function class, trigger type (time / odometer / hours / hybrid), and HVNL relevance.
- Plans link templates to vehicles and are evaluated by a single scheduling function:
  - `getMaintenancePlanSchedule`

The planner and dashboards do **not** recompute this logic in the frontend.

#### MaintenanceWorkOrder

Work orders support:

- Plan-based preventative maintenance (`Scheduled`, `raised_from = Schedule`).
- Ad-hoc / corrective / defect / incident repairs (`Corrective`, `DefectRepair`).
- Links to:
  - `linked_prestart_defect_id`
  - `linked_incident_id`
  - `linked_service_record_id`

---

### Usage & Downtime

#### UsageRecord

Primary utilisation metric is **shifts**, not hours.

- `shifts_count` – core metric
- `shift_type` – `Day`, `Night`, `Split`, `Other`
- Optional: `total_hours`, `km_travelled`, `jobs_count`
- Ownership snapshots and estimated hire cost are stored at record time.

#### AssetDowntimeEvent

Captures downtime windows including:

- `reason` – `Service`, `Breakdown`, `Accident`, etc.
- `cause_category` – `PreventativeService`, `CorrectiveRepair`, `HireProviderDelay`, `PartsDelay`, `IncidentRepair`, `Other`
- `chargeable_to` – `KPI`, `HireProvider`, `Client`, `Shared`

Used for:

- Stand-down / hire credit analysis.
- Hire provider performance.
- Project and fleet uptime metrics.

---

### Prestarts, Defects, Incidents, Worker Risk

- **PrestartCheck** – raw prestart signals and odometer entries from Assignar/manual.
- **PrestartDefect** – defect records with severity and lifecycle, linked to service and work orders.
- **IncidentRecord** – accidents, near misses, HVNL breaches and damage events.
- **WorkerRiskStatus** – rolling risk score per worker, based on prestarts, defects and incidents (Green / Amber / Red).

These drive:

- Automated work order creation (from critical defects/incidents).
- Worker risk alerts for HSE and management.
- HVNL risk and compliance dashboards.

---

### Fuel

**FuelTransaction** is the canonical fuel usage entity.

- Data is ingested via **CSV/Excel from the fleet card provider** (FuelImport workflow).
- No live photo/OCR flow is used for fuel in operations.

Key fields:

- `transaction_datetime`
- `litres`, `total_cost`, `price_per_litre`
- `site_location`, `fuel_type`, `card_provider`
- `ownership_type_snapshot`, `hire_provider_id_snapshot`
- `source` – `FuelImport`, `Manual`

---

## RBAC & Roles

Fleet-specific roles (on the User):

- `FleetAdmin`
- `WorkshopOps`
- `StateOps`
- `Viewer`

High-level:

- **FleetAdmin** – full control: templates, plans, WOs, imports, exports, notification & automation config.
- **WorkshopOps** – manage work orders and confirm services, assist with imports (cannot commit).
- **StateOps** – view dashboards, vehicles, defects and incidents; limited edits.
- **Viewer** – read-only.

All critical operations (imports, exports, automation config) are enforced server-side, not just hidden in UI.

---

## Automations & Alerts

Controlled via:

- `NotificationConfig` – who gets what.
- `AutomationConfig` – kill switches and thresholds.
- `AlertLog` – audit trail.

Key implemented automations include:

- Auto WOs from plans (upcoming services within threshold).
- Auto WOs from High/Critical defects (no existing repair WO).
- Optional auto WOs from serious/critical incidents.
- Alerts for:
  - Plans moving to `DueSoon` / `Overdue`.
  - Overdue work orders.
  - High/Critical defects left open too long.
  - Worker risk transitions to `Amber` or `Red`.
- Monthly HVNL and maintenance reports.

Every automation:

- Checks its **AutomationConfig kill switch**.
- Resolves recipients via **NotificationConfig**.
- Logs to **AlertLog** on success/failure.

---

## Imports

### Service History

- Wizard flow: Upload → Map → Validate → Resolve → Commit.
- Only rows with `resolution_status = Ready` are committed.
- Commit is blocked when unresolved/invalid/duplicate rows exist.
- Commit is restricted to `FleetAdmin`.

### Fuel

- Same pattern as service imports.
- CSV/Excel import from fleet card providers, resulting in `FuelTransaction` records.
- No active fuel receipt OCR flow in UI.

---

## Export Contracts for Trae

These are the **v1 export contracts**. Field names and structures must not change without explicit versioning.

All exports:

- Require `FleetAdmin` role.
- Support basic filtering (date range, state, ownership, provider).
- Are paginated.

### 1. `exportVehiclesForTrae`

Returns fleet vehicles plus odometer snapshot information.

### 2. `exportMaintenanceDataForTrae`

Returns:

- `maintenanceTemplates`
- `maintenancePlans` (with derived scheduling fields)
- `maintenanceWorkOrders`
- `serviceRecords` (incl. `cost_chargeable_to` and cost breakdown)

### 3. `exportOperationalDataForTrae`

Returns:

- `assetDowntimeEvents`
- `usageRecords`
- `prestartChecks`
- `prestartDefects`
- `incidentRecords`
- `fuelTransactions`

### 4. `exportWorkerRiskDataForTrae`

Returns:

- `workerRiskStatuses` and associated metrics.

These endpoints are the **integration surface for the Trae-backed implementation**. The Trae services are expected to ingest/replicate this model and behaviour.

---

## Backend Freeze Spec

The full backend model and rules are documented in:

- `docs/KPI-FleetIQ-Backend-Spec.md`

That document defines:

- Entity schemas and relationships
- Business rules (owned vs hire, shift-based utilisation, odometer logic, HVNL logic)
- RBAC model and privileges
- Automation/alert behaviour
- Import/commit rules
- Export contracts for Trae

This spec is **frozen for v1.0** and must be treated as a contract between the existing Base44 implementation and the new Trae-backed system.

---

## Development Guidelines

- Do **not** change field names or export response shapes without versioning.
- Any behaviour changes that affect exports, cost rules, or HVNL logic require:
  - An update to `KPI-FleetIQ-Backend-Spec.md`
  - A new version tag (e.g. `v1.1`) and explicit agreement between stakeholders.
- Bug fixes and internal performance improvements are allowed provided they do **not** break:
  - The semantics described in the freeze spec.
  - The export contracts for Trae.

