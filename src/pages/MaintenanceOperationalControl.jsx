import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format, addDays } from "date-fns";
import {
  Filter,
  Calendar,
  AlertTriangle,
  Clock,
  ExternalLink,
  Plus,
  Wrench,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";

export default function MaintenanceOperationalControl() {
  const [filters, setFilters] = useState({
    dateRangeStart: format(new Date(), "yyyy-MM-dd"),
    dateRangeEnd: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    state: "all",
    functionClass: "all",
    ownership: "all",
    hvnlRelevance: "all",
    provider: "all",
  });

  const { data: planScheduleData, isLoading } = useQuery({
    queryKey: [
      "maintenancePlanSchedule",
      filters.dateRangeStart,
      filters.dateRangeEnd,
      filters.state,
      filters.functionClass,
      filters.ownership,
      filters.provider,
      filters.hvnlRelevance,
    ],
    queryFn: async () => {
      const response = await base44.functions.invoke("getMaintenancePlanSchedule", {
        dateRangeStart: filters.dateRangeStart,
        dateRangeEnd: filters.dateRangeEnd,
        stateFilter: filters.state,
        functionClassFilter: filters.functionClass,
        ownershipFilter: filters.ownership,
        providerFilter: filters.provider,
      });
      return response.data;
    },
  });

  const { data: maintenanceTemplates = [] } = useQuery({
    queryKey: ["maintenanceTemplates"],
    queryFn: () => base44.entities.MaintenanceTemplate.list(),
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["workOrders"],
    queryFn: () => base44.entities.MaintenanceWorkOrder.list("-raised_datetime", 500),
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

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

  const allPlans = planScheduleData?.plans || [];

  // Filter for HVNL relevance
  const filteredPlans = useMemo(() => {
    return allPlans.filter(plan => {
      if (filters.hvnlRelevance === "hvnl" && !plan.is_hvnl_critical) return false;
      if (filters.hvnlRelevance === "non-hvnl" && plan.is_hvnl_critical) return false;
      return true;
    });
  }, [allPlans, filters.hvnlRelevance]);

  // Calculate upcoming services (DueSoon status)
  const upcomingServices = useMemo(() => {
    return filteredPlans
      .filter(plan => plan.is_due_soon)
      .map(plan => ({
        plan,
        vehicle: plan.vehicle,
        template: plan.template,
        dueDate: new Date(plan.next_due_date),
        daysUntilDue: plan.days_until_due,
      }))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [filteredPlans]);

  // Calculate overdue plans
  const overduePlans = useMemo(() => {
    return filteredPlans
      .filter(plan => plan.is_overdue)
      .map(plan => ({
        plan,
        vehicle: plan.vehicle,
        template: plan.template,
        dueDate: plan.next_due_date ? new Date(plan.next_due_date) : null,
        daysOverdue: plan.days_overdue,
      }))
      .sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  }, [filteredPlans]);

  // Open work orders
  const openWorkOrders = useMemo(() => {
    const vehicleIds = new Set(filteredPlans.map(p => p.vehicle_id));
    
    return workOrders
      .filter((wo) => {
        if (wo.status === "Completed" || wo.status === "Cancelled") return false;
        if (!vehicleIds.has(wo.vehicle_id)) return false;

        const template = templateMap[wo.maintenance_template_id];
        if (filters.hvnlRelevance === "hvnl" && !template?.hvnl_relevance_flag) return false;
        if (filters.hvnlRelevance === "non-hvnl" && template?.hvnl_relevance_flag) return false;

        return true;
      })
      .map((wo) => {
        const plan = allPlans.find(p => p.id === wo.maintenance_plan_id);
        const vehicle = plan?.vehicle || {};
        const template = templateMap[wo.maintenance_template_id];
        const dueDate = wo.due_date ? new Date(wo.due_date) : null;
        const now = new Date();
        const isOverdue = dueDate && dueDate < now;
        const isDueSoon = dueDate && !isOverdue && Math.floor((dueDate - now) / (1000 * 60 * 60 * 24)) <= 7;

        return {
          wo,
          vehicle,
          template,
          dueDate,
          isOverdue,
          isDueSoon,
        };
      })
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate - b.dueDate;
      });
  }, [workOrders, allPlans, filteredPlans, templateMap, filters]);

  const getPriorityBadge = (priority) => {
    const styles = {
      SafetyCritical: "bg-red-50 text-red-700 border-red-200",
      Major: "bg-orange-50 text-orange-700 border-orange-200",
      Routine: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return (
      <Badge variant="outline" className={styles[priority] || styles.Routine}>
        {priority}
      </Badge>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wrench className="w-8 h-8 text-indigo-600" />
            Maintenance Operational Control
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Day-to-day execution view</p>
        </div>
      </div>

      {/* Global Filters */}
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
              value={filters.hvnlRelevance}
              onValueChange={(v) => setFilters({ ...filters, hvnlRelevance: v })}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="HVNL" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="hvnl">HVNL Only</SelectItem>
                <SelectItem value="non-hvnl">Non-HVNL</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.provider}
              onValueChange={(v) => setFilters({ ...filters, provider: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {hireProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Services */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Upcoming Services (Next 30 Days)
              </h2>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {upcomingServices.length}
              </Badge>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead>Vehicle</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Until Due</TableHead>
                    <TableHead>Odometer Due</TableHead>
                    <TableHead>HVNL</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingServices.map(({ plan, vehicle, template, dueDate, daysUntilDue }) => {
                    const isDueSoon = daysUntilDue <= 7;
                    return (
                      <TableRow
                        key={plan.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 ${
                          isDueSoon ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                        }`}
                      >
                        <TableCell className="font-medium">
                          <Link
                            to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}
                            className="text-indigo-600 hover:underline"
                          >
                            {vehicle.asset_code}
                          </Link>
                          <p className="text-sm text-slate-500">{vehicle.rego}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-100">
                            {vehicle.state}
                          </Badge>
                        </TableCell>
                        <TableCell>{template?.name || "Unknown"}</TableCell>
                        <TableCell>
                          {format(dueDate, "d MMM yyyy")}
                          {isDueSoon && (
                            <p className="text-xs text-amber-600 font-medium mt-1">Due Soon</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isDueSoon
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100"
                            }
                          >
                            {daysUntilDue} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {plan.next_due_odometer_km
                            ? `${plan.next_due_odometer_km.toLocaleString()} km`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {template?.hvnl_relevance_flag && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              HVNL
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link to={createPageUrl(`MaintenancePlanner`)}>
                              <Button variant="ghost" size="sm" className="text-xs">
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Planner
                              </Button>
                            </Link>
                            <Link to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}>
                              <Button variant="ghost" size="sm" className="text-xs">
                                <Plus className="w-3 h-3 mr-1" />
                                Raise WO
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {upcomingServices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-2" />
                        No upcoming services in the next 30 days
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Overdue Plans */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Overdue Maintenance Plans
              </h2>
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                {overduePlans.length}
              </Badge>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead>Vehicle</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Odometer Due</TableHead>
                    <TableHead>Current KM</TableHead>
                    <TableHead>HVNL</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overduePlans.map(({ plan, vehicle, template, dueDate, daysOverdue }) => {
                    const isHVNL = template?.hvnl_relevance_flag;
                    return (
                      <TableRow
                        key={plan.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 ${
                          isHVNL ? "bg-red-50/50 dark:bg-red-900/10" : "bg-rose-50/50 dark:bg-rose-900/10"
                        }`}
                      >
                        <TableCell className="font-medium">
                          <Link
                            to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}
                            className="text-indigo-600 hover:underline"
                          >
                            {vehicle.asset_code}
                          </Link>
                          <p className="text-sm text-slate-500">{vehicle.rego}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-100">
                            {vehicle.state}
                          </Badge>
                        </TableCell>
                        <TableCell>{template?.name || "Unknown"}</TableCell>
                        <TableCell>
                          {dueDate ? format(dueDate, "d MMM yyyy") : "-"}
                          <p className="text-xs text-rose-600 font-medium mt-1">OVERDUE</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                            {daysOverdue ? `${daysOverdue} days` : "Check KM"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {plan.next_due_odometer_km
                            ? `${plan.next_due_odometer_km.toLocaleString()} km`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {vehicle.current_odometer_km
                            ? `${vehicle.current_odometer_km.toLocaleString()} km`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {isHVNL && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              HVNL
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link to={createPageUrl(`MaintenancePlanner`)}>
                              <Button variant="ghost" size="sm" className="text-xs">
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Planner
                              </Button>
                            </Link>
                            <Link to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}>
                              <Button variant="ghost" size="sm" className="text-xs">
                                <Plus className="w-3 h-3 mr-1" />
                                Raise WO
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {overduePlans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-2" />
                        No overdue maintenance plans
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Open Work Orders */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Open Work Orders
              </h2>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {openWorkOrders.length}
              </Badge>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead>Vehicle</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Workshop/Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HVNL</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openWorkOrders.map(({ wo, vehicle, template, dueDate, isOverdue, isDueSoon }) => {
                    const isHVNL = template?.hvnl_relevance_flag;
                    return (
                      <TableRow
                        key={wo.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 ${
                          isOverdue
                            ? "bg-rose-50/50 dark:bg-rose-900/10"
                            : isDueSoon
                            ? "bg-amber-50/50 dark:bg-amber-900/10"
                            : ""
                        }`}
                      >
                        <TableCell className="font-medium">
                          <Link
                            to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}
                            className="text-indigo-600 hover:underline"
                          >
                            {vehicle.asset_code}
                          </Link>
                          <p className="text-sm text-slate-500">{vehicle.rego}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-100">
                            {vehicle.state}
                          </Badge>
                        </TableCell>
                        <TableCell>{template?.name || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 text-xs">
                            {wo.work_order_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {dueDate ? (
                            <>
                              {format(dueDate, "d MMM yyyy")}
                              {isOverdue && (
                                <p className="text-xs text-rose-600 font-medium mt-1">OVERDUE</p>
                              )}
                              {isDueSoon && !isOverdue && (
                                <p className="text-xs text-amber-600 font-medium mt-1">Due Soon</p>
                              )}
                            </>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{getPriorityBadge(wo.priority)}</TableCell>
                        <TableCell>
                          {wo.assigned_to_workshop_name ||
                            (wo.assigned_to_hire_provider_id
                              ? providerMap[wo.assigned_to_hire_provider_id]?.name
                              : "-")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                wo.status === "InProgress"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }
                            >
                              {wo.status}
                            </Badge>
                            {wo.linked_prestart_defect_id && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                Defect
                              </Badge>
                            )}
                            {wo.linked_incident_id && (
                              <Link to={createPageUrl(`IncidentDetail?id=${wo.linked_incident_id}`)}>
                                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs cursor-pointer hover:bg-rose-100">
                                  Incident
                                </Badge>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isHVNL && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              HVNL
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}>
                            <Button variant="ghost" size="sm" className="text-xs">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {openWorkOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-2" />
                        No open work orders
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}