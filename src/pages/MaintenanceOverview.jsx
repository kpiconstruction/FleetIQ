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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
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
import HvnlRiskLeaderboard from "../components/maintenance/HvnlRiskLeaderboard";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

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

  // Fetch compliance aggregates from backend
  const { data: complianceData, isLoading: complianceLoading } = useQuery({
    queryKey: [
      "maintenanceCompliance",
      filters.dateRangeStart,
      filters.dateRangeEnd,
      filters.state,
      filters.functionClass,
      filters.ownership,
      filters.provider,
    ],
    queryFn: async () => {
      const response = await base44.functions.invoke("getMaintenanceComplianceAggregates", {
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

  // Fetch cost aggregates from backend
  const { data: costData, isLoading: costLoading } = useQuery({
    queryKey: [
      "maintenanceCost",
      filters.dateRangeStart,
      filters.dateRangeEnd,
      filters.state,
      filters.functionClass,
      filters.ownership,
      filters.provider,
    ],
    queryFn: async () => {
      const response = await base44.functions.invoke("getMaintenanceCostAggregates", {
        dateRangeStart: filters.dateRangeStart,
        dateRangeEnd: filters.dateRangeEnd,
        stateFilter: filters.state,
        functionClassFilter: filters.functionClass,
        ownershipFilter: filters.ownership,
        providerFilter: filters.provider,
        repeatRepairThreshold: 3,
      });
      return response.data;
    },
  });

  // Fetch downtime aggregates from backend
  const { data: downtimeData, isLoading: downtimeLoading } = useQuery({
    queryKey: [
      "downtimeAggregates",
      filters.dateRangeStart,
      filters.dateRangeEnd,
      filters.state,
      filters.functionClass,
      filters.ownership,
      filters.provider,
    ],
    queryFn: async () => {
      const response = await base44.functions.invoke("getDowntimeAggregates", {
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

  // Create lookup maps
  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, {});
  }, [vehicles]);

  const templateMap = useMemo(() => {
    const map = {};
    maintenanceTemplates.forEach(t => {
      if (t && t.id) map[t.id] = t;
    });
    return map;
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

  const isLoading = vehiclesLoading || complianceLoading || costLoading || downtimeLoading;

  // Prepare downtime by cause category data for chart
  const downtimeByCauseData = useMemo(() => {
    if (!downtimeData?.byCauseCategory) return [];
    return Object.entries(downtimeData.byCauseCategory)
      .filter(([_, data]) => data.downtime_hours > 0)
      .map(([category, data]) => ({
        name: category.replace(/([A-Z])/g, ' $1').trim(),
        value: Math.round(data.downtime_hours),
        percentage: Math.round(data.percentage),
      }));
  }, [downtimeData]);

  // Prepare downtime by function class data for chart
  const downtimeByClassData = useMemo(() => {
    if (!downtimeData?.byFunctionClass) return [];
    return downtimeData.byFunctionClass
      .filter(d => d.downtime_hours > 0)
      .slice(0, 10)
      .map(d => ({
        name: d.name,
        hours: Math.round(d.downtime_hours),
        events: d.event_count,
      }));
  }, [downtimeData]);

  // Prepare downtime by hire provider data for chart
  const downtimeByProviderData = useMemo(() => {
    if (!downtimeData?.byHireProvider) return [];
    return downtimeData.byHireProvider
      .filter(d => d.downtime_hours > 0)
      .slice(0, 10)
      .map(d => ({
        name: d.name,
        hours: Math.round(d.downtime_hours),
        events: d.event_count,
      }));
  }, [downtimeData]);

  // Prepare cost by class data for chart
  const costByClassData = useMemo(() => {
    if (!costData?.byClass) return [];
    return Object.entries(costData.byClass)
      .map(([className, data]) => ({
        className,
        totalCost: Math.round(data.totalCost),
        costPerAsset: Math.round(data.costPerAsset),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [costData]);

  // Prepare compliance by state data for chart
  const complianceByStateData = useMemo(() => {
    if (!complianceData?.aggregates?.byState) return [];
    return Object.entries(complianceData.aggregates.byState)
      .map(([state, agg]) => ({
        state,
        compliance: parseFloat(agg.onTimeCompliancePercent),
        completed: agg.servicesCompletedOnTime,
        total: agg.servicesCompletedOnTime + agg.servicesCompletedLate,
      }))
      .sort((a, b) => b.compliance - a.compliance);
  }, [complianceData]);

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

      {/* Compliance Widgets */}
      {!complianceLoading && complianceData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* On-Time Compliance by State */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              On-Time Compliance % by State
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceByStateData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" />
                <YAxis dataKey="state" type="category" stroke="#64748b" />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                          <p className="font-semibold">{data.state}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {data.compliance}% on-time
                          </p>
                          <p className="text-xs text-slate-500">
                            {data.completed} / {data.total} services
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="compliance" fill="#6366f1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {complianceByStateData.map((item) => (
                <div key={item.state} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item.state}</p>
                  <p className={`text-2xl font-bold ${item.compliance >= 90 ? 'text-emerald-600' : item.compliance >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {item.compliance}%
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.completed}/{item.total}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* HVNL Compliance Gauge */}
          <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 rounded-2xl shadow-sm border border-red-100 dark:border-red-900 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              HVNL Compliance
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              HVNL-critical assets only
            </p>
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-48 h-48">
                <svg className="transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#fee2e2"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={
                      parseFloat(complianceData.aggregates.hvnl.hvnlCompliancePercent) >= 95
                        ? "#10b981"
                        : parseFloat(complianceData.aggregates.hvnl.hvnlCompliancePercent) >= 85
                        ? "#f59e0b"
                        : "#ef4444"
                    }
                    strokeWidth="8"
                    strokeDasharray={`${(parseFloat(complianceData.aggregates.hvnl.hvnlCompliancePercent) / 100) * 251.2} 251.2`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                    {complianceData.aggregates.hvnl.hvnlCompliancePercent}%
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">On-Time</p>
                </div>
              </div>
              <div className="mt-4 w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Completed On-Time:</span>
                  <span className="font-semibold">{complianceData.aggregates.hvnl.servicesCompletedOnTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Completed Late:</span>
                  <span className="font-semibold text-amber-600">{complianceData.aggregates.hvnl.servicesCompletedLate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Still Overdue:</span>
                  <span className="font-semibold text-rose-600">{complianceData.aggregates.hvnl.plansStillOverdue}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preventative Completion Ratio Card */}
      {!complianceLoading && complianceData && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Preventative Completion Ratio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-6">
              <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-400">
                {complianceData.aggregates.overall.preventativeCompletionRatio}%
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 text-center">
                Overall Completion Ratio
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Completed On-Time / Due in Period
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Plans Due in Period</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {complianceData.aggregates.overall.plansDueInPeriod}
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-6">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-2">Completed On-Time</p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                {complianceData.aggregates.overall.servicesCompletedOnTime}
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-6">
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">Completed Late</p>
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                {complianceData.aggregates.overall.servicesCompletedLate}
              </p>
            </div>
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

      {/* Cost by Vehicle Function Class */}
      {!costLoading && costData && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 mt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Maintenance Cost by Vehicle Function Class
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={costByClassData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="className" stroke="#64748b" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#64748b" />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                        <p className="font-semibold">{data.className}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Total: ${data.totalCost.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">
                          Per Asset: ${data.costPerAsset.toLocaleString()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar dataKey="totalCost" fill="#6366f1" name="Total Cost ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* High-Cost Assets Table */}
      {!costLoading && costData?.assetAggregates && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mt-6">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-600" />
                  High-Cost Assets
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Top maintenance spenders
                </p>
              </div>
              {costData.summary?.repeat_repair_assets > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  {costData.summary.repeat_repair_assets} Repeat Repairs
                </Badge>
              )}
            </div>
          </div>
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Asset Code</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Cost/1000km</TableHead>
                  <TableHead>Cost/Hour</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costData.assetAggregates.slice(0, 20).map((asset, index) => (
                  <TableRow
                    key={asset.vehicle_id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 ${
                      asset.repeat_repair_flag ? "bg-amber-50/30 dark:bg-amber-900/10" : ""
                    }`}
                  >
                    <TableCell className="font-semibold text-slate-400">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to={createPageUrl(`VehicleDetail?id=${asset.vehicle_id}`)}
                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {asset.asset_code}
                      </Link>
                      <p className="text-xs text-slate-500">{asset.rego}</p>
                    </TableCell>
                    <TableCell className="text-sm">{asset.vehicle_function_class}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-100">
                        {asset.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-indigo-600">
                      ${asset.total_cost.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {asset.total_km > 0 ? `$${asset.cost_per_1000km}` : "-"}
                    </TableCell>
                    <TableCell>
                      {asset.total_hours > 0 ? `$${asset.cost_per_hour}` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-50">
                        {asset.service_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {asset.repeat_repair_flag && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Repeat ({asset.repeat_repair_count})
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {costData.assetAggregates.length > 20 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing top 20 of {costData.assetAggregates.length} assets
              </p>
            </div>
          )}
        </div>
      )}

      {/* Downtime Attribution Section */}
      {!downtimeLoading && downtimeData && (
        <>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Downtime by Cause Category */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Downtime by Cause Category
              </h2>
              {downtimeByCauseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={downtimeByCauseData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {downtimeByCauseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                              <p className="font-semibold">{payload[0].name}</p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {payload[0].value} hours ({payload[0].payload.percentage}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-500 py-16">No downtime data</p>
              )}
            </div>

            {/* Downtime by Vehicle Function Class */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Downtime by Vehicle Class
              </h2>
              {downtimeByClassData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={downtimeByClassData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis dataKey="name" type="category" stroke="#64748b" width={120} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                              <p className="font-semibold">{payload[0].payload.name}</p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {payload[0].value} hours ({payload[0].payload.events} events)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="hours" fill="#f59e0b" name="Downtime Hours" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-500 py-16">No downtime data</p>
              )}
            </div>
          </div>

          {/* Downtime by Hire Provider */}
          {downtimeByProviderData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 mt-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Downtime by Hire Provider
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={downtimeByProviderData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                            <p className="font-semibold">{payload[0].payload.name}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {payload[0].value} hours ({payload[0].payload.events} events)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="hours" fill="#8b5cf6" name="Downtime Hours" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* HVNL Risk Leaderboard */}
      <div className="mt-6">
        <HvnlRiskLeaderboard limit={15} />
      </div>
    </div>
  );
}