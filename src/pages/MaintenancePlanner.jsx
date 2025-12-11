import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, addDays } from "date-fns";
import {
  Wrench,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  ChevronRight,
  Lock,
} from "lucide-react";
import { usePermissions } from "../components/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function MaintenancePlanner() {
  const { can, fleetRole } = usePermissions();

  const [filters, setFilters] = useState({
    dateRangeStart: format(new Date(), "yyyy-MM-dd"),
    dateRangeEnd: format(addDays(new Date(), 60), "yyyy-MM-dd"),
    state: "all",
    functionClass: "all",
    ownership: "all",
    provider: "all",
    status: "all",
  });

  const [raiseWorkOrderDialog, setRaiseWorkOrderDialog] = useState(null);
  const [workOrderForm, setWorkOrderForm] = useState({});

  const queryClient = useQueryClient();

  const { data: planScheduleData, isLoading } = useQuery({
    queryKey: [
      "maintenancePlanSchedule",
      filters.dateRangeStart,
      filters.dateRangeEnd,
      filters.state,
      filters.functionClass,
      filters.ownership,
      filters.provider,
      filters.status,
    ],
    queryFn: async () => {
      const response = await base44.functions.invoke("getMaintenancePlanSchedule", {
        dateRangeStart: filters.dateRangeStart,
        dateRangeEnd: filters.dateRangeEnd,
        stateFilter: filters.state,
        functionClassFilter: filters.functionClass,
        ownershipFilter: filters.ownership,
        providerFilter: filters.provider,
        statusFilter: filters.status,
      });
      return response.data;
    },
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.MaintenanceWorkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      setRaiseWorkOrderDialog(null);
      setWorkOrderForm({});
    },
  });

  const providerMap = useMemo(() => {
    return hireProviders.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
  }, [hireProviders]);

  const enrichedPlans = planScheduleData?.plans || [];
  const summary = planScheduleData?.summary || {
    total_plans: 0,
    overdue_count: 0,
    due_soon_count: 0,
    hvnl_critical_overdue: 0,
  };

  const handleRaiseWorkOrder = (plan) => {
    setWorkOrderForm({
      vehicle_id: plan.vehicle_id,
      maintenance_plan_id: plan.id,
      maintenance_template_id: plan.maintenance_template_id,
      work_order_type: "Scheduled",
      raised_from: "Schedule",
      raised_datetime: new Date().toISOString(),
      due_date: plan.next_due_date || "",
      status: "Open",
      priority: plan.template.priority,
      odometer_at_raise: plan.vehicle.current_odometer_km || 0,
      assigned_to_workshop_name: "",
      notes_internal: "",
      notes_for_provider: plan.template.task_summary || "",
    });
    setRaiseWorkOrderDialog(plan);
  };

  const submitWorkOrder = () => {
    createWorkOrderMutation.mutate(workOrderForm);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wrench className="w-8 h-8 text-indigo-600" />
            Preventative Maintenance Planner
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {enrichedPlans.length} active maintenance plans
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Filters:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-600">From:</Label>
              <Input
                type="date"
                value={filters.dateRangeStart}
                onChange={(e) => setFilters({ ...filters, dateRangeStart: e.target.value })}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-600">To:</Label>
              <Input
                type="date"
                value={filters.dateRangeEnd}
                onChange={(e) => setFilters({ ...filters, dateRangeEnd: e.target.value })}
                className="w-40"
              />
            </div>

            <Select value={filters.state} onValueChange={(v) => setFilters({ ...filters, state: v })}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="VIC">VIC</SelectItem>
                <SelectItem value="NSW">NSW</SelectItem>
                <SelectItem value="QLD">QLD</SelectItem>
                <SelectItem value="TAS">TAS</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.functionClass}
              onValueChange={(v) => setFilters({ ...filters, functionClass: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Function" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="TMA">TMA</SelectItem>
                <SelectItem value="PodTruckTruck">Pod Truck</SelectItem>
                <SelectItem value="TrafficUte">Traffic Ute</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.ownership}
              onValueChange={(v) => setFilters({ ...filters, ownership: v })}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Ownership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Owned">Owned</SelectItem>
                <SelectItem value="ContractHire">Contract Hire</SelectItem>
                <SelectItem value="DayHire">Day Hire</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(v) => setFilters({ ...filters, status: v })}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Upcoming Services</span>
            </div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {summary.due_soon_count}
            </p>
            <p className="text-xs text-slate-400 mt-1">Next 30 days</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Overdue Services</span>
            </div>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{summary.overdue_count}</p>
            <p className="text-xs text-slate-400 mt-1">Require attention</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">On Track</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.on_track_count}
            </p>
            <p className="text-xs text-slate-400 mt-1">Scheduled</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">HVNL-Critical Overdue</span>
            </div>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {summary.hvnl_critical_overdue}
            </p>
            <p className="text-xs text-slate-400 mt-1">Compliance risk</p>
          </div>
        </div>
      )}

      {/* Main Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                <TableHead>Asset Code</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Function Class</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Next Due Date</TableHead>
                <TableHead>Next Due KM</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedPlans.map((plan) => {
                const statusColor = 
                  plan.status === "Overdue" ? "bg-rose-50 text-rose-700 border-rose-200" :
                  plan.status === "DueSoon" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-slate-100 text-slate-700 border-slate-200";

                return (
                  <TableRow
                    key={plan.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700"
                  >
                    <TableCell className="font-medium">{plan.vehicle.asset_code}</TableCell>
                    <TableCell>{plan.vehicle.state}</TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                      {plan.vehicle.vehicle_function_class}
                    </TableCell>
                    <TableCell className="font-medium">
                      {plan.template.name}
                      {plan.is_hvnl_critical && (
                        <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200 text-xs">
                          HVNL
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="bg-slate-50">
                        {plan.template.trigger_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {plan.next_due_date ? (
                        <div>
                          <p className="font-medium">{format(new Date(plan.next_due_date), "d MMM yyyy")}</p>
                          <p className="text-xs text-slate-500">
                            {plan.days_until_due !== null
                              ? `${plan.days_until_due} days`
                              : plan.days_overdue !== null
                              ? `${plan.days_overdue} days overdue`
                              : ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.next_due_odometer_km ? (
                        <div>
                          <p className="font-medium">{plan.next_due_odometer_km.toLocaleString()}</p>
                          {plan.vehicle.current_odometer_km && (
                            <p className="text-xs text-slate-500">
                              Current: {plan.vehicle.current_odometer_km.toLocaleString()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor}>
                        {plan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {plan.vehicle.ownership_type}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {plan.vehicle.hire_provider_id
                        ? providerMap[plan.vehicle.hire_provider_id]?.name || "-"
                        : "-"}
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
              {enrichedPlans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12">
                    <p className="text-slate-500 dark:text-slate-400">
                      No maintenance plans match the filters
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

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
                    {raiseWorkOrderDialog.vehicle.asset_code} ({raiseWorkOrderDialog.vehicle.rego})
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Template</p>
                  <p className="font-semibold">{raiseWorkOrderDialog.template.name}</p>
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