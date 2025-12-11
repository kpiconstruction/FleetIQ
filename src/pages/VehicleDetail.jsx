import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format, subDays } from "date-fns";
import {
  ArrowLeft,
  Truck,
  Building2,
  Calendar,
  Gauge,
  CheckCircle,
  XCircle,
  Edit,
  Fuel,
  Clock,
  Activity,
  ClipboardCheck,
  Wrench,
  AlertTriangle,
  Plus,
  Lock,
} from "lucide-react";
import { usePermissions } from "../components/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function VehicleDetail() {
  const { can } = usePermissions();
  const urlParams = new URLSearchParams(window.location.search);
  const vehicleId = urlParams.get("id");

  const [raiseWorkOrderDialog, setRaiseWorkOrderDialog] = useState(null);
  const [workOrderForm, setWorkOrderForm] = useState({});

  const queryClient = useQueryClient();

  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => base44.entities.Vehicle.filter({ id: vehicleId }),
    enabled: !!vehicleId,
    select: (data) => data[0],
  });

  const { data: hireProvider } = useQuery({
    queryKey: ["hireProvider", vehicle?.hire_provider_id],
    queryFn: () => base44.entities.HireProvider.filter({ id: vehicle.hire_provider_id }),
    enabled: !!vehicle?.hire_provider_id,
    select: (data) => data[0],
  });

  const { data: contract } = useQuery({
    queryKey: ["contract", vehicle?.contract_id],
    queryFn: () => base44.entities.HireContract.filter({ id: vehicle.contract_id }),
    enabled: !!vehicle?.contract_id,
    select: (data) => data[0],
  });

  const { data: prestarts = [] } = useQuery({
    queryKey: ["prestarts", vehicleId],
    queryFn: () => base44.entities.PrestartCheck.filter({ vehicle_id: vehicleId }, "-prestart_datetime", 50),
    enabled: !!vehicleId,
  });

  const { data: serviceRecords = [] } = useQuery({
    queryKey: ["serviceRecords", vehicleId],
    queryFn: () => base44.entities.ServiceRecord.filter({ vehicle_id: vehicleId }, "-service_date", 50),
    enabled: !!vehicleId,
  });

  const { data: downtimeEvents = [] } = useQuery({
    queryKey: ["downtimeEvents", vehicleId],
    queryFn: () => base44.entities.AssetDowntimeEvent.filter({ vehicle_id: vehicleId }, "-start_datetime", 50),
    enabled: !!vehicleId,
  });

  const { data: usageRecords = [] } = useQuery({
    queryKey: ["usageRecords", vehicleId],
    queryFn: () => base44.entities.UsageRecord.filter({ vehicle_id: vehicleId }, "-usage_date", 50),
    enabled: !!vehicleId,
  });

  const { data: fuelTransactions = [] } = useQuery({
    queryKey: ["fuelTransactions", vehicleId],
    queryFn: () => base44.entities.FuelTransaction.filter({ vehicle_id: vehicleId }, "-transaction_datetime", 50),
    enabled: !!vehicleId,
  });

  const { data: maintenancePlanSchedule } = useQuery({
    queryKey: ["maintenancePlanSchedule", vehicleId],
    queryFn: async () => {
      const response = await base44.functions.invoke("getMaintenancePlanSchedule", {
        stateFilter: "all",
        functionClassFilter: "all",
        ownershipFilter: "all",
        providerFilter: "all",
      });
      return response.data;
    },
    enabled: !!vehicleId,
  });

  const { data: maintenanceTemplates = [] } = useQuery({
    queryKey: ["maintenanceTemplates"],
    queryFn: () => base44.entities.MaintenanceTemplate.filter({ active: true }),
  });

  const { data: maintenanceWorkOrders = [] } = useQuery({
    queryKey: ["maintenanceWorkOrders", vehicleId],
    queryFn: () => base44.entities.MaintenanceWorkOrder.filter({ vehicle_id: vehicleId }, "-raised_datetime", 50),
    enabled: !!vehicleId,
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.MaintenanceWorkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenanceWorkOrders"] });
      setRaiseWorkOrderDialog(null);
      setWorkOrderForm({});
    },
  });

  const thirtyDaysAgo = subDays(new Date(), 30);
  const recentUsage = usageRecords.filter((u) => new Date(u.usage_date) >= thirtyDaysAgo);
  const totalHours30d = recentUsage.reduce((sum, u) => sum + (u.total_hours || 0), 0);
  const totalKm30d = recentUsage.reduce((sum, u) => sum + (u.km_travelled || 0), 0);
  const recentFuel = fuelTransactions.filter((f) => new Date(f.transaction_datetime) >= thirtyDaysAgo);
  const totalFuel30d = recentFuel.reduce((sum, f) => sum + (f.total_cost || 0), 0);

  // Create template lookup
  const templateMap = useMemo(() => {
    return maintenanceTemplates.reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});
  }, [maintenanceTemplates]);

  const providerMap = useMemo(() => {
    return hireProviders.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
  }, [hireProviders]);

  // Get vehicle-specific maintenance plans from schedule data
  const vehiclePlans = useMemo(() => {
    if (!maintenancePlanSchedule?.plans) return [];
    return maintenancePlanSchedule.plans.filter(p => p.vehicle_id === vehicleId);
  }, [maintenancePlanSchedule, vehicleId]);

  // Calculate maintenance status from precomputed data
  const maintenanceStatus = useMemo(() => {
    if (!vehiclePlans.length) return null;

    let earliestDueDate = null;
    let earliestDueOdometer = null;
    let overallStatus = "On Track";

    vehiclePlans.forEach((plan) => {
      if (plan.status === "Overdue") {
        overallStatus = "Overdue";
      } else if (plan.status === "DueSoon" && overallStatus !== "Overdue") {
        overallStatus = "Due Soon";
      }

      // Track earliest due
      if (plan.next_due_date) {
        const dueDate = new Date(plan.next_due_date);
        if (!earliestDueDate || dueDate < earliestDueDate) {
          earliestDueDate = dueDate;
        }
      }
      if (plan.next_due_odometer_km) {
        if (!earliestDueOdometer || plan.next_due_odometer_km < earliestDueOdometer) {
          earliestDueOdometer = plan.next_due_odometer_km;
        }
      }
    });

    return {
      status: overallStatus,
      nextDueDate: earliestDueDate,
      nextDueOdometer: earliestDueOdometer,
    };
  }, [vehiclePlans]);

  const handleRaiseWorkOrder = (plan) => {
    setWorkOrderForm({
      vehicle_id: vehicleId,
      maintenance_plan_id: plan.id,
      maintenance_template_id: plan.maintenance_template_id,
      work_order_type: "Scheduled",
      raised_from: "Schedule",
      raised_datetime: new Date().toISOString(),
      due_date: plan.next_due_date || "",
      status: "Open",
      priority: plan.template?.priority || "Routine",
      odometer_at_raise: vehicle?.current_odometer_km || 0,
      assigned_to_workshop_name: "",
      notes_internal: "",
      notes_for_provider: plan.template?.task_summary || "",
    });
    setRaiseWorkOrderDialog(plan);
  };

  const submitWorkOrder = () => {
    createWorkOrderMutation.mutate(workOrderForm);
  };

  if (vehicleLoading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-6 lg:p-8">
        <p>Vehicle not found</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const styles = {
      Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
      "In Maintenance": "bg-amber-50 text-amber-700 border-amber-200",
      Decommissioned: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return (
      <Badge variant="outline" className={`text-sm ${styles[status]}`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl("Vehicles")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{vehicle.asset_code}</h1>
            {getStatusBadge(vehicle.status)}
          </div>
          <p className="text-slate-500 dark:text-slate-400">{vehicle.rego} • {vehicle.asset_type}</p>
        </div>
        <Link to={createPageUrl(`VehicleForm?id=${vehicle.id}`)}>
          <Button variant="outline">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Last Prestart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <ClipboardCheck className="w-4 h-4" />
            <span className="text-sm font-medium">Last Prestart</span>
          </div>
          <div className="flex items-center gap-2">
            {vehicle.last_prestart_result === "Pass" ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : vehicle.last_prestart_result === "Fail" ? (
              <XCircle className="w-5 h-5 text-rose-500" />
            ) : null}
            <span className="text-lg font-semibold">
              {vehicle.last_prestart_result || "No data"}
            </span>
          </div>
          {vehicle.last_prestart_date && (
            <p className="text-sm text-slate-500 mt-1">
              {format(new Date(vehicle.last_prestart_date), "d MMM yyyy")}
            </p>
          )}
        </div>

        {/* Service */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <Wrench className="w-4 h-4" />
            <span className="text-sm font-medium">Service</span>
          </div>
          <p className="text-lg font-semibold">
            {vehicle.last_service_date ? format(new Date(vehicle.last_service_date), "d MMM yyyy") : "No record"}
          </p>
          {vehicle.next_service_due_date && (
            <p className={`text-sm mt-1 ${new Date(vehicle.next_service_due_date) < new Date() ? "text-rose-600 font-medium" : "text-slate-500"}`}>
              Next: {format(new Date(vehicle.next_service_due_date), "d MMM yyyy")}
            </p>
          )}
        </div>

        {/* 30 Day Stats */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-medium">30 Day Activity</span>
          </div>
          <p className="text-lg font-semibold">{Math.round(totalHours30d)} hrs</p>
          <p className="text-sm text-slate-500">{Math.round(totalKm30d).toLocaleString()} km</p>
        </div>

        {/* Fuel */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <Fuel className="w-4 h-4" />
            <span className="text-sm font-medium">30 Day Fuel</span>
          </div>
          <p className="text-lg font-semibold">${totalFuel30d.toLocaleString()}</p>
          <p className="text-sm text-slate-500">{recentFuel.length} transactions</p>
        </div>
      </div>

      {/* Ownership Card (for hire vehicles) */}
      {vehicle.ownership_type !== "Owned" && (
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-2xl p-6 mb-8 border border-violet-100 dark:border-violet-900">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <h3 className="font-semibold text-violet-900 dark:text-violet-200">Hire Details</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-violet-600 dark:text-violet-400">Type</p>
              <p className="font-medium text-violet-900 dark:text-violet-200">{vehicle.ownership_type === "ContractHire" ? "Contract Hire" : "Day Hire"}</p>
            </div>
            <div>
              <p className="text-sm text-violet-600 dark:text-violet-400">Provider</p>
              <p className="font-medium text-violet-900 dark:text-violet-200">{hireProvider?.name || "-"}</p>
            </div>
            {contract && (
              <>
                <div>
                  <p className="text-sm text-violet-600 dark:text-violet-400">Contract</p>
                  <p className="font-medium text-violet-900 dark:text-violet-200">{contract.contract_name}</p>
                </div>
                <div>
                  <p className="text-sm text-violet-600 dark:text-violet-400">Rate</p>
                  <p className="font-medium text-violet-900 dark:text-violet-200">${contract.rate_amount} {contract.rate_basis?.replace("per_", "/")}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="prestarts" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="prestarts" className="rounded-lg">Prestarts</TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-lg">Maintenance</TabsTrigger>
          <TabsTrigger value="service" className="rounded-lg">Service</TabsTrigger>
          <TabsTrigger value="downtime" className="rounded-lg">Downtime</TabsTrigger>
          <TabsTrigger value="usage" className="rounded-lg">Usage</TabsTrigger>
          <TabsTrigger value="fuel" className="rounded-lg">Fuel</TabsTrigger>
        </TabsList>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance">
          {/* Maintenance Summary Panel */}
          {maintenanceStatus && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-2xl p-6 mb-6 border border-indigo-100 dark:border-indigo-900">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2">
                    <Wrench className="w-5 h-5" />
                    Next Service Due
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-indigo-600 dark:text-indigo-400">Date</p>
                      <p className="font-medium text-indigo-900 dark:text-indigo-200">
                        {maintenanceStatus.nextDueDate
                          ? format(maintenanceStatus.nextDueDate, "d MMM yyyy")
                          : "Not scheduled"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-indigo-600 dark:text-indigo-400">Odometer</p>
                      <p className="font-medium text-indigo-900 dark:text-indigo-200">
                        {maintenanceStatus.nextDueOdometer
                          ? `${maintenanceStatus.nextDueOdometer.toLocaleString()} km`
                          : "Not scheduled"}
                      </p>
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    maintenanceStatus.status === "Overdue"
                      ? "bg-rose-50 text-rose-700 border-rose-200 text-lg px-4 py-2"
                      : maintenanceStatus.status === "Due Soon"
                      ? "bg-amber-50 text-amber-700 border-amber-200 text-lg px-4 py-2"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 text-lg px-4 py-2"
                  }
                >
                  {maintenanceStatus.status === "Overdue" && <AlertTriangle className="w-4 h-4 mr-2" />}
                  {maintenanceStatus.status}
                </Badge>
              </div>
            </div>
          )}

          {/* Active Maintenance Plans */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Active Maintenance Plans
            </h3>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Template</TableHead>
                    <TableHead>Trigger Type</TableHead>
                    <TableHead>Next Due Date</TableHead>
                    <TableHead>Next Due KM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehiclePlans
                    .filter((p) => p.status !== "Suspended")
                    .map((plan) => {
                      const statusColor = 
                        plan.status === "Overdue" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        plan.status === "DueSoon" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-slate-100 text-slate-700 border-slate-200";

                      return (
                        <TableRow
                          key={plan.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700"
                        >
                          <TableCell className="font-medium">
                            {plan.template?.name || "Unknown"}
                            {plan.is_hvnl_critical && (
                              <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200 text-xs">
                                HVNL
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-slate-50">
                              {plan.template?.trigger_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {plan.next_due_date ? (
                              <>
                                <p className="font-medium">{format(new Date(plan.next_due_date), "d MMM yyyy")}</p>
                                <p className="text-xs text-slate-500">
                                  {plan.days_until_due !== null
                                    ? `${plan.days_until_due} days`
                                    : plan.days_overdue !== null
                                    ? `${plan.days_overdue} days overdue`
                                    : ""}
                                </p>
                              </>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {plan.next_due_odometer_km ? `${plan.next_due_odometer_km.toLocaleString()} km` : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColor}>
                              {plan.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {can.createWorkOrder ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRaiseWorkOrder(plan)}
                                className="text-xs"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Raise WO
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="text-xs"
                                title="FleetAdmin or WorkshopOps role required"
                              >
                                <Lock className="w-3 h-3 mr-1" />
                                Raise WO
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {vehiclePlans.filter((p) => p.status !== "Suspended").length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No active maintenance plans
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Maintenance Work Orders */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Maintenance Work Orders
            </h3>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Raised</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Workshop/Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Service Record</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceWorkOrders.map((wo) => {
                    const template = templateMap[wo.maintenance_template_id];
                    const linkedService = serviceRecords.find((s) => s.id === wo.linked_service_record_id);

                    return (
                      <TableRow
                        key={wo.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700"
                      >
                        <TableCell>{format(new Date(wo.raised_datetime), "d MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 text-xs">
                            {wo.work_order_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{template?.name || "-"}</TableCell>
                        <TableCell>
                          {wo.due_date ? format(new Date(wo.due_date), "d MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {wo.assigned_to_workshop_name ||
                            (wo.assigned_to_hire_provider_id
                              ? providerMap[wo.assigned_to_hire_provider_id]?.name
                              : "-")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              wo.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : wo.status === "InProgress"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : wo.status === "Cancelled"
                                ? "bg-slate-100 text-slate-600 border-slate-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }
                          >
                            {wo.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {linkedService ? (
                            <span className="text-sm text-indigo-600 dark:text-indigo-400">
                              {format(new Date(linkedService.service_date), "d MMM yyyy")}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {maintenanceWorkOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No work orders
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Service Records */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Service History
            </h3>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Workshop</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Downtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceRecords.map((s) => (
                    <TableRow key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                      <TableCell>{format(new Date(s.service_date), "d MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            s.service_type === "Scheduled"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : s.service_type === "Breakdown"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : s.service_type === "HireProviderService"
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {s.service_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{s.workshop_name || "-"}</TableCell>
                      <TableCell>${s.cost_ex_gst?.toLocaleString() || "0"}</TableCell>
                      <TableCell>{s.downtime_hours ? `${s.downtime_hours}h` : "-"}</TableCell>
                    </TableRow>
                  ))}
                  {serviceRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No service records
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Prestarts Tab */}
        <TabsContent value="prestarts">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Client/Project</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Defects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestarts.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b dark:border-slate-700">
                    <TableCell>{format(new Date(p.prestart_datetime), "d MMM yyyy HH:mm")}</TableCell>
                    <TableCell>{p.worker_name || p.operator_name}</TableCell>
                    <TableCell className="text-slate-600">{p.client_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.overall_result === "Pass" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}>
                        {p.overall_result}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.defect_count || 0}</TableCell>
                  </TableRow>
                ))}
                {prestarts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">No prestart records</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Service Tab */}
        <TabsContent value="service">
          <div className="flex justify-end mb-4">
            <Link to={createPageUrl(`ServiceForm?vehicle_id=${vehicleId}`)}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">Add Service Record</Button>
            </Link>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Workshop</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Downtime</TableHead>
                  <TableHead>Chargeable To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceRecords.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                    <TableCell>{format(new Date(s.service_date), "d MMM yyyy")}</TableCell>
                    <TableCell>{s.service_type}</TableCell>
                    <TableCell>{s.workshop_name || "-"}</TableCell>
                    <TableCell>${s.cost_ex_gst?.toLocaleString() || "0"}</TableCell>
                    <TableCell>{s.downtime_hours ? `${s.downtime_hours}h` : "-"}</TableCell>
                    <TableCell>{s.downtime_chargeable_to || "-"}</TableCell>
                  </TableRow>
                ))}
                {serviceRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">No service records</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Downtime Tab */}
        <TabsContent value="downtime">
          <div className="flex justify-end mb-4">
            <Link to={createPageUrl(`DowntimeForm?vehicle_id=${vehicleId}`)}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">Log Downtime Event</Button>
            </Link>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Caused By</TableHead>
                  <TableHead>Stand-Down</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {downtimeEvents.map((d) => (
                  <TableRow key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                    <TableCell>{format(new Date(d.start_datetime), "d MMM HH:mm")}</TableCell>
                    <TableCell>{d.end_datetime ? format(new Date(d.end_datetime), "d MMM HH:mm") : "Ongoing"}</TableCell>
                    <TableCell>{d.downtime_hours || "-"}</TableCell>
                    <TableCell>{d.reason}</TableCell>
                    <TableCell>{d.caused_by}</TableCell>
                    <TableCell>
                      {d.stand_down_expected && (
                        <Badge variant="outline" className={d.stand_down_confirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                          {d.stand_down_confirmed ? "Confirmed" : "Expected"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {downtimeEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">No downtime events</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Km</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Project</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageRecords.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                    <TableCell>{format(new Date(u.usage_date), "d MMM yyyy")}</TableCell>
                    <TableCell>{u.total_hours || "-"}</TableCell>
                    <TableCell>{u.km_travelled || "-"}</TableCell>
                    <TableCell>{u.jobs_count || "-"}</TableCell>
                    <TableCell>{u.project_code || "-"}</TableCell>
                  </TableRow>
                ))}
                {usageRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">No usage records</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Fuel Tab */}
        <TabsContent value="fuel">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Litres</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Odometer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fuelTransactions.map((f) => (
                  <TableRow key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                    <TableCell>{format(new Date(f.transaction_datetime), "d MMM yyyy HH:mm")}</TableCell>
                    <TableCell>{f.litres?.toFixed(1)}L</TableCell>
                    <TableCell>${f.total_cost?.toFixed(2)}</TableCell>
                    <TableCell>{f.site_location || "-"}</TableCell>
                    <TableCell>{f.odometer_at_fill?.toLocaleString() || "-"}</TableCell>
                  </TableRow>
                ))}
                {fuelTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400">No fuel transactions</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Raise Work Order Dialog */}
      <Dialog open={!!raiseWorkOrderDialog} onOpenChange={() => setRaiseWorkOrderDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Raise Maintenance Work Order</DialogTitle>
          </DialogHeader>
          {raiseWorkOrderDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Vehicle</p>
                  <p className="font-semibold">
                    {vehicle.asset_code} ({vehicle.rego})
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Template</p>
                  <p className="font-semibold">{templateMap[raiseWorkOrderDialog.maintenance_template_id]?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Priority</p>
                  <Badge
                    variant="outline"
                    className={
                      workOrderForm.priority === "SafetyCritical"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-100"
                    }
                  >
                    {workOrderForm.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Odometer</p>
                  <p className="font-semibold">{workOrderForm.odometer_at_raise?.toLocaleString()} km</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={workOrderForm.due_date}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Assigned Workshop</Label>
                  <Input
                    value={workOrderForm.assigned_to_workshop_name}
                    onChange={(e) =>
                      setWorkOrderForm({ ...workOrderForm, assigned_to_workshop_name: e.target.value })
                    }
                    placeholder="Workshop name"
                  />
                </div>
              </div>

              <div>
                <Label>Notes for Provider</Label>
                <Textarea
                  value={workOrderForm.notes_for_provider}
                  onChange={(e) =>
                    setWorkOrderForm({ ...workOrderForm, notes_for_provider: e.target.value })
                  }
                  rows={4}
                  placeholder="Service instructions and checklist items..."
                />
              </div>

              <div>
                <Label>Internal Notes</Label>
                <Textarea
                  value={workOrderForm.notes_internal}
                  onChange={(e) =>
                    setWorkOrderForm({ ...workOrderForm, notes_internal: e.target.value })
                  }
                  rows={2}
                  placeholder="Internal notes..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaiseWorkOrderDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitWorkOrder}
              disabled={createWorkOrderMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {createWorkOrderMutation.isPending ? "Creating..." : "Create Work Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}