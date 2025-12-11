import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, subMonths, subDays, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth } from "date-fns";
import {
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Filter,
  Calendar,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function MaintenanceOverview() {
  const [filters, setFilters] = useState({
    dateRangeStart: format(subMonths(new Date(), 6), "yyyy-MM-dd"),
    dateRangeEnd: format(new Date(), "yyyy-MM-dd"),
    state: "all",
    functionClass: "all",
    ownership: "all",
    hvnlRelevance: "all",
    provider: "all",
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: maintenancePlans = [] } = useQuery({
    queryKey: ["maintenancePlans"],
    queryFn: () => base44.entities.MaintenancePlan.list(),
  });

  const { data: maintenanceTemplates = [] } = useQuery({
    queryKey: ["maintenanceTemplates"],
    queryFn: () => base44.entities.MaintenanceTemplate.list(),
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["workOrders"],
    queryFn: () => base44.entities.MaintenanceWorkOrder.list("-raised_datetime", 1000),
  });

  const { data: serviceRecords = [] } = useQuery({
    queryKey: ["serviceRecords"],
    queryFn: () => base44.entities.ServiceRecord.list("-service_date", 1000),
  });

  const { data: downtimeEvents = [] } = useQuery({
    queryKey: ["downtimeEvents"],
    queryFn: () => base44.entities.AssetDowntimeEvent.list("-start_datetime", 1000),
  });

  const { data: usageRecords = [] } = useQuery({
    queryKey: ["usageRecords"],
    queryFn: () => base44.entities.UsageRecord.list("-usage_date", 2000),
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  // Create lookup maps
  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, {});
  }, [vehicles]);

  const templateMap = useMemo(() => {
    return maintenanceTemplates.reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});
  }, [maintenanceTemplates]);

  // Filter vehicles based on criteria
  const filteredVehicleIds = useMemo(() => {
    return new Set(
      vehicles
        .filter((v) => {
          if (filters.state !== "all" && v.state !== filters.state) return false;
          if (filters.functionClass !== "all" && v.vehicle_function_class !== filters.functionClass)
            return false;
          if (filters.ownership !== "all" && v.ownership_type !== filters.ownership) return false;
          if (filters.provider !== "all" && v.hire_provider_id !== filters.provider) return false;
          return true;
        })
        .map((v) => v.id)
    );
  }, [vehicles, filters]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const startDate = new Date(filters.dateRangeStart);
    const endDate = new Date(filters.dateRangeEnd);
    const now = new Date();

    // Filter work orders for period
    const periodWorkOrders = workOrders.filter((wo) => {
      if (!filteredVehicleIds.has(wo.vehicle_id)) return false;
      const raisedDate = new Date(wo.raised_datetime);
      return raisedDate >= startDate && raisedDate <= endDate;
    });

    // Filter by HVNL relevance if needed
    const relevantWorkOrders =
      filters.hvnlRelevance === "all"
        ? periodWorkOrders
        : periodWorkOrders.filter((wo) => {
            const template = templateMap[wo.maintenance_template_id];
            return filters.hvnlRelevance === "hvnl" ? template?.hvnl_relevance_flag : !template?.hvnl_relevance_flag;
          });

    // Calculate on-time services
    const scheduledWOs = relevantWorkOrders.filter((wo) => wo.work_order_type === "Scheduled");
    const completedOnTime = scheduledWOs.filter((wo) => {
      if (wo.status !== "Completed") return false;
      const linkedService = serviceRecords.find((s) => s.id === wo.linked_service_record_id);
      if (!linkedService || !wo.due_date) return false;
      return new Date(linkedService.service_date) <= new Date(wo.due_date);
    }).length;

    const onTimePercentage =
      scheduledWOs.length > 0 ? ((completedOnTime / scheduledWOs.length) * 100).toFixed(1) : 0;

    // Calculate overdue services
    const activePlans = maintenancePlans.filter(
      (p) => p.status === "Active" && filteredVehicleIds.has(p.vehicle_id)
    );

    const overduePlans = activePlans.filter((plan) => {
      const template = templateMap[plan.maintenance_template_id];
      if (filters.hvnlRelevance === "hvnl" && !template?.hvnl_relevance_flag) return false;
      if (filters.hvnlRelevance === "non-hvnl" && template?.hvnl_relevance_flag) return false;

      if (plan.next_due_date && new Date(plan.next_due_date) < now) return true;
      const vehicle = vehicleMap[plan.vehicle_id];
      if (
        plan.next_due_odometer_km &&
        vehicle?.current_odometer_km &&
        vehicle.current_odometer_km >= plan.next_due_odometer_km
      )
        return true;
      return false;
    });

    const hvnlCriticalOverdue = overduePlans.filter((plan) => {
      const template = templateMap[plan.maintenance_template_id];
      return template?.hvnl_relevance_flag;
    }).length;

    // Calculate maintenance cost
    const periodServices = serviceRecords.filter((s) => {
      if (!filteredVehicleIds.has(s.vehicle_id)) return false;
      const serviceDate = new Date(s.service_date);
      return serviceDate >= startDate && serviceDate <= endDate;
    });

    const totalMaintenanceCost = periodServices.reduce((sum, s) => sum + (s.cost_ex_gst || 0), 0);

    // Calculate downtime hours
    const periodDowntime = downtimeEvents.filter((d) => {
      if (!filteredVehicleIds.has(d.vehicle_id)) return false;
      const startDt = new Date(d.start_datetime);
      return startDt >= startDate && startDt <= endDate;
    });

    const plannedDowntime = periodDowntime
      .filter((d) => d.reason === "Service")
      .reduce((sum, d) => sum + (d.downtime_hours || 0), 0);

    const unplannedDowntime = periodDowntime
      .filter((d) => d.reason === "Breakdown" || d.reason === "Accident")
      .reduce((sum, d) => sum + (d.downtime_hours || 0), 0);

    return {
      onTimePercentage,
      overdueServices: overduePlans.length,
      hvnlCriticalOverdue,
      totalMaintenanceCost,
      plannedDowntime,
      unplannedDowntime,
    };
  }, [
    workOrders,
    serviceRecords,
    maintenancePlans,
    downtimeEvents,
    filteredVehicleIds,
    templateMap,
    vehicleMap,
    filters,
  ]);

  // Trend data: Services Completed vs Overdue Backlog
  const servicesTrendData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: new Date(filters.dateRangeStart),
      end: new Date(filters.dateRangeEnd),
    });

    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const completed = workOrders.filter((wo) => {
        if (!filteredVehicleIds.has(wo.vehicle_id)) return false;
        if (wo.status !== "Completed") return false;
        const linkedService = serviceRecords.find((s) => s.id === wo.linked_service_record_id);
        if (!linkedService) return false;
        const serviceDate = new Date(linkedService.service_date);
        return serviceDate >= monthStart && serviceDate <= monthEnd;
      }).length;

      const overdue = maintenancePlans.filter((plan) => {
        if (!filteredVehicleIds.has(plan.vehicle_id)) return false;
        if (plan.status !== "Active") return false;
        if (!plan.next_due_date) return false;
        const dueDate = new Date(plan.next_due_date);
        return dueDate < monthEnd && dueDate >= monthStart;
      }).length;

      return {
        month: format(month, "MMM yy"),
        completed,
        overdue,
      };
    });
  }, [workOrders, serviceRecords, maintenancePlans, filteredVehicleIds, filters]);

  // Maintenance Cost Trend
  const costTrendData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: new Date(filters.dateRangeStart),
      end: new Date(filters.dateRangeEnd),
    });

    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthServices = serviceRecords.filter((s) => {
        if (!filteredVehicleIds.has(s.vehicle_id)) return false;
        const serviceDate = new Date(s.service_date);
        return serviceDate >= monthStart && serviceDate <= monthEnd;
      });

      const totalCost = monthServices.reduce((sum, s) => sum + (s.cost_ex_gst || 0), 0);

      // Calculate km traveled in period
      const monthUsage = usageRecords.filter((u) => {
        if (!filteredVehicleIds.has(u.vehicle_id)) return false;
        const usageDate = new Date(u.usage_date);
        return usageDate >= monthStart && usageDate <= monthEnd;
      });

      const totalKm = monthUsage.reduce((sum, u) => sum + (u.km_travelled || 0), 0);
      const costPer1000Km = totalKm > 0 ? (totalCost / totalKm) * 1000 : 0;

      return {
        month: format(month, "MMM yy"),
        totalCost: Math.round(totalCost),
        costPer1000Km: Math.round(costPer1000Km),
      };
    });
  }, [serviceRecords, usageRecords, filteredVehicleIds, filters]);

  // Maintenance Mix (Preventative vs Corrective vs Defect Repair)
  const maintenanceMixData = useMemo(() => {
    const startDate = new Date(filters.dateRangeStart);
    const endDate = new Date(filters.dateRangeEnd);

    const periodWorkOrders = workOrders.filter((wo) => {
      if (!filteredVehicleIds.has(wo.vehicle_id)) return false;
      const raisedDate = new Date(wo.raised_datetime);
      return raisedDate >= startDate && raisedDate <= endDate;
    });

    const preventative = periodWorkOrders.filter((wo) => wo.work_order_type === "Scheduled").length;
    const corrective = periodWorkOrders.filter((wo) => wo.work_order_type === "Corrective").length;
    const defectRepair = periodWorkOrders.filter((wo) => wo.work_order_type === "DefectRepair").length;

    return [
      { name: "Preventative", value: preventative, color: "#10b981" },
      { name: "Corrective", value: corrective, color: "#f59e0b" },
      { name: "Defect Repair", value: defectRepair, color: "#ef4444" },
    ];
  }, [workOrders, filteredVehicleIds, filters]);

  const isLoading = vehiclesLoading;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-8 h-8 text-indigo-600" />
            Maintenance Executive Overview
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Performance metrics and trends
          </p>
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

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">On-Time Services</span>
            </div>
            <p className={`text-3xl font-bold ${parseFloat(metrics.onTimePercentage) >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
              {metrics.onTimePercentage}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Preventative</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Overdue Services</span>
            </div>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">
              {metrics.overdueServices}
            </p>
            <p className="text-xs text-slate-400 mt-1">Active plans</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">HVNL-Critical</span>
            </div>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {metrics.hvnlCriticalOverdue}
            </p>
            <p className="text-xs text-slate-400 mt-1">Overdue</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">Total Cost</span>
            </div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              ${(metrics.totalMaintenanceCost / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-slate-400 mt-1">Period spend</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Downtime</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {Math.round(metrics.plannedDowntime + metrics.unplannedDowntime)}h
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {Math.round(metrics.plannedDowntime)}h planned / {Math.round(metrics.unplannedDowntime)}h unplanned
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Services Completed vs Overdue Backlog */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Services Completed vs Overdue Backlog
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={servicesTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
              <Line type="monotone" dataKey="overdue" stroke="#ef4444" strokeWidth={2} name="Overdue" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Maintenance Mix */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Maintenance Type Mix
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={maintenanceMixData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {maintenanceMixData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Maintenance Cost Trend */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Maintenance Cost Trend
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={costTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#64748b" />
            <YAxis yAxisId="left" stroke="#64748b" />
            <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="totalCost" fill="#6366f1" name="Total Cost ($)" />
            <Bar yAxisId="right" dataKey="costPer1000Km" fill="#f59e0b" name="Cost per 1,000 km ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}