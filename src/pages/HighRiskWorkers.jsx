import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format, subDays, subMonths } from "date-fns";
import {
  AlertTriangle,
  Filter,
  Download,
  Eye,
  X,
  TrendingUp,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function HighRiskWorkers() {
  const [filters, setFilters] = useState({
    dateRange: "12",
    state: "all",
    functionClass: "all",
    ownership: "all",
    minRiskLevel: "all",
  });

  const [selectedWorker, setSelectedWorker] = useState(null);

  const { data: prestarts = [], isLoading: prestartsLoading } = useQuery({
    queryKey: ["prestarts"],
    queryFn: () => base44.entities.PrestartCheck.list("-prestart_datetime", 5000),
  });

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => base44.entities.IncidentRecord.list("-incident_datetime", 2000),
  });

  const { data: defects = [] } = useQuery({
    queryKey: ["defects"],
    queryFn: () => base44.entities.PrestartDefect.list("-reported_at", 2000),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, {});
  }, [vehicles]);

  // Calculate worker risk data
  const workerRiskData = useMemo(() => {
    const now = new Date();
    const ninetyDaysAgo = subDays(now, 90);
    const monthsAgo = subMonths(now, parseInt(filters.dateRange));

    const workerData = {};

    // Process prestarts
    prestarts.forEach((p) => {
      const workerName = p.worker_name || p.operator_name;
      if (!workerName) return;

      const vehicle = vehicleMap[p.vehicle_id];
      if (!vehicle) return;

      // Apply filters
      if (filters.state !== "all" && vehicle.state !== filters.state) return;
      if (filters.functionClass !== "all" && vehicle.vehicle_function_class !== filters.functionClass) return;
      if (filters.ownership !== "all" && vehicle.ownership_type !== filters.ownership) return;

      if (!workerData[workerName]) {
        workerData[workerName] = {
          worker_name: workerName,
          worker_external_id: p.worker_external_id,
          failed_prestarts_90d: 0,
          critical_defects_90d: 0,
          incidents_12m: 0,
          hvnl_incidents_12m: 0,
          at_fault_count_12m: 0,
          states: new Set(),
          function_classes: new Set(),
          all_prestarts: [],
          all_incidents: [],
        };
      }

      workerData[workerName].all_prestarts.push(p);

      const prestartDate = new Date(p.prestart_datetime);
      if (prestartDate >= ninetyDaysAgo) {
        if (p.overall_result === "Fail") {
          workerData[workerName].failed_prestarts_90d++;
        }
      }

      workerData[workerName].states.add(vehicle.state);
      workerData[workerName].function_classes.add(vehicle.vehicle_function_class);
    });

    // Process defects
    defects.forEach((d) => {
      const prestart = prestarts.find((p) => p.id === d.prestart_id);
      if (!prestart) return;

      const workerName = prestart.worker_name || prestart.operator_name;
      if (!workerName || !workerData[workerName]) return;

      const defectDate = new Date(d.reported_at || prestart.prestart_datetime);
      if (defectDate >= ninetyDaysAgo && d.severity === "Critical") {
        workerData[workerName].critical_defects_90d++;
      }
    });

    // Process incidents
    incidents.forEach((inc) => {
      const workerName = inc.driver_name;
      if (!workerName) return;

      const vehicle = vehicleMap[inc.vehicle_id];
      if (vehicle) {
        if (filters.state !== "all" && vehicle.state !== filters.state) return;
        if (filters.functionClass !== "all" && vehicle.vehicle_function_class !== filters.functionClass) return;
        if (filters.ownership !== "all" && vehicle.ownership_type !== filters.ownership) return;
      }

      if (!workerData[workerName]) {
        workerData[workerName] = {
          worker_name: workerName,
          worker_external_id: inc.driver_external_id,
          failed_prestarts_90d: 0,
          critical_defects_90d: 0,
          incidents_12m: 0,
          hvnl_incidents_12m: 0,
          at_fault_count_12m: 0,
          states: vehicle ? new Set([vehicle.state]) : new Set(),
          function_classes: vehicle ? new Set([vehicle.vehicle_function_class]) : new Set(),
          all_prestarts: [],
          all_incidents: [],
        };
      }

      const incidentDate = new Date(inc.incident_datetime);
      if (incidentDate >= monthsAgo) {
        workerData[workerName].incidents_12m++;
        workerData[workerName].at_fault_count_12m++;
        workerData[workerName].all_incidents.push(inc);

        if (inc.incident_type === "HVNL Breach") {
          workerData[workerName].hvnl_incidents_12m++;
        }
      }
    });

    // Calculate risk levels
    return Object.values(workerData).map((worker) => {
      let riskLevel = "Green";
      let riskScore = 0;

      // High (Red) criteria
      if (
        worker.at_fault_count_12m >= 2 ||
        (worker.hvnl_incidents_12m >= 1 && incidents.find(i => i.driver_name === worker.worker_name && (i.severity === "Critical" || i.severity === "Serious"))) ||
        worker.critical_defects_90d >= 3 ||
        worker.failed_prestarts_90d >= 5
      ) {
        riskLevel = "Red";
        riskScore = 10;
      }
      // Medium (Amber) criteria
      else if (
        worker.at_fault_count_12m === 1 ||
        worker.hvnl_incidents_12m >= 1 ||
        (worker.critical_defects_90d >= 1 && worker.critical_defects_90d <= 2) ||
        (worker.failed_prestarts_90d >= 3 && worker.failed_prestarts_90d <= 4)
      ) {
        riskLevel = "Amber";
        riskScore = 5;
      }

      return {
        ...worker,
        state: Array.from(worker.states).join(", "),
        vehicle_function_class: Array.from(worker.function_classes).join(", "),
        risk_level: riskLevel,
        risk_score: riskScore,
        status: riskLevel === "Red" ? "Action Required" : riskLevel === "Amber" ? "Monitor" : "OK",
      };
    });
  }, [prestarts, incidents, defects, vehicleMap, filters]);

  // Apply risk level filter
  const filteredWorkers = useMemo(() => {
    let filtered = workerRiskData;

    if (filters.minRiskLevel === "amber") {
      filtered = filtered.filter((w) => w.risk_level === "Amber" || w.risk_level === "Red");
    } else if (filters.minRiskLevel === "red") {
      filtered = filtered.filter((w) => w.risk_level === "Red");
    }

    return filtered.sort((a, b) => b.risk_score - a.risk_score);
  }, [workerRiskData, filters.minRiskLevel]);

  // KPI calculations
  const highRiskCount = workerRiskData.filter((w) => w.risk_level === "Red").length;
  const mediumRiskCount = workerRiskData.filter((w) => w.risk_level === "Amber").length;
  const totalHvnlIncidents = workerRiskData.reduce((sum, w) => sum + w.hvnl_incidents_12m, 0);
  const totalCriticalDefects = workerRiskData.reduce((sum, w) => sum + w.critical_defects_90d, 0);

  // Risk Distribution Chart Data
  const riskDistribution = [
    { level: "Low (Green)", count: workerRiskData.filter((w) => w.risk_level === "Green").length },
    { level: "Medium (Amber)", count: mediumRiskCount },
    { level: "High (Red)", count: highRiskCount },
  ];

  // HVNL Incident Trend Data
  const hvnlTrendData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = subMonths(new Date(), i);
      const monthEnd = subMonths(new Date(), i - 1);

      const monthIncidents = incidents.filter((inc) => {
        const date = new Date(inc.incident_datetime);
        return inc.incident_type === "HVNL Breach" && date >= monthStart && date < monthEnd;
      });

      months.push({
        month: format(monthStart, "MMM yy"),
        count: monthIncidents.length,
      });
    }
    return months;
  }, [incidents]);

  const getRiskBadge = (level) => {
    const styles = {
      Red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400",
      Amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400",
      Green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400",
    };
    return (
      <Badge variant="outline" className={styles[level]}>
        {level === "Red" && <AlertTriangle className="w-3 h-3 mr-1" />}
        {level}
      </Badge>
    );
  };

  const exportToCSV = () => {
    const headers = ["Worker Name", "State", "Function Class", "Failed Prestarts", "Critical Defects", "Incidents", "HVNL", "At-Fault", "Risk Level"];
    const rows = filteredWorkers.map((w) => [
      w.worker_name,
      w.state,
      w.vehicle_function_class,
      w.failed_prestarts_90d,
      w.critical_defects_90d,
      w.incidents_12m,
      w.hvnl_incidents_12m,
      w.at_fault_count_12m,
      w.risk_level,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `high-risk-workers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const isLoading = prestartsLoading || incidentsLoading;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
            High-Risk Workers (HVNL & Safety Exposure)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredWorkers.length} workers monitored
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Global Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Filters:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filters.dateRange} onValueChange={(v) => setFilters({ ...filters, dateRange: v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="24">Last 24 months</SelectItem>
              </SelectContent>
            </Select>

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
                <SelectItem value="NT">NT</SelectItem>
                <SelectItem value="ACT">ACT</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.functionClass} onValueChange={(v) => setFilters({ ...filters, functionClass: v })}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Function Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="TMA">TMA</SelectItem>
                <SelectItem value="PodTruckTruck">Pod Truck</SelectItem>
                <SelectItem value="TrafficUte">Traffic Ute</SelectItem>
                <SelectItem value="VMSUte">VMS Ute</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.ownership} onValueChange={(v) => setFilters({ ...filters, ownership: v })}>
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

            <Select value={filters.minRiskLevel} onValueChange={(v) => setFilters({ ...filters, minRiskLevel: v })}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="amber">Amber+</SelectItem>
                <SelectItem value="red">Red Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">High-Risk Workers</p>
            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{highRiskCount}</p>
            <p className="text-xs text-slate-400 mt-1">Red level</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Medium-Risk Workers</p>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{mediumRiskCount}</p>
            <p className="text-xs text-slate-400 mt-1">Amber level</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">HVNL Incidents</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{totalHvnlIncidents}</p>
            <p className="text-xs text-slate-400 mt-1">Last 12 months</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Critical Defects</p>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{totalCriticalDefects}</p>
            <p className="text-xs text-slate-400 mt-1">Last 90 days</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Risk Distribution Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Risk Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={riskDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="level" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* HVNL Incident Trend Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">HVNL Incident Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hvnlTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} name="HVNL Incidents" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                <TableHead>Worker Name</TableHead>
                <TableHead>State(s)</TableHead>
                <TableHead>Function Class</TableHead>
                <TableHead className="text-center">Failed Prestarts (90d)</TableHead>
                <TableHead className="text-center">Critical Defects (90d)</TableHead>
                <TableHead className="text-center">Incidents (12m)</TableHead>
                <TableHead className="text-center">HVNL</TableHead>
                <TableHead className="text-center">At-Fault</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkers.map((worker, idx) => (
                <TableRow
                  key={idx}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b dark:border-slate-700"
                  onClick={() => setSelectedWorker(worker)}
                >
                  <TableCell className="font-medium">{worker.worker_name}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">{worker.state}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-sm">{worker.vehicle_function_class}</TableCell>
                  <TableCell className="text-center">
                    {worker.failed_prestarts_90d > 0 ? (
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                        {worker.failed_prestarts_90d}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {worker.critical_defects_90d > 0 ? (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        {worker.critical_defects_90d}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {worker.incidents_12m > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        {worker.incidents_12m}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {worker.hvnl_incidents_12m > 0 ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-semibold">
                        {worker.hvnl_incidents_12m}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-semibold">{worker.at_fault_count_12m}</TableCell>
                  <TableCell>{getRiskBadge(worker.risk_level)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        worker.status === "Action Required"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : worker.status === "Monitor"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }
                    >
                      {worker.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </TableCell>
                </TableRow>
              ))}
              {filteredWorkers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12">
                    <p className="text-slate-500 dark:text-slate-400">No workers match the selected filters</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Slide-over Worker Risk Profile */}
      <Sheet open={!!selectedWorker} onOpenChange={() => setSelectedWorker(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedWorker && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-indigo-600" />
                  {selectedWorker.worker_name}
                  {getRiskBadge(selectedWorker.risk_level)}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Summary Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Failed Prestarts</p>
                    <p className="text-2xl font-bold text-rose-600">{selectedWorker.failed_prestarts_90d}</p>
                    <p className="text-xs text-slate-500">Last 90 days</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Critical Defects</p>
                    <p className="text-2xl font-bold text-orange-600">{selectedWorker.critical_defects_90d}</p>
                    <p className="text-xs text-slate-500">Last 90 days</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Incidents</p>
                    <p className="text-2xl font-bold text-amber-600">{selectedWorker.incidents_12m}</p>
                    <p className="text-xs text-slate-500">Last 12 months</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">HVNL Incidents</p>
                    <p className="text-2xl font-bold text-red-600">{selectedWorker.hvnl_incidents_12m}</p>
                    <p className="text-xs text-slate-500">Last 12 months</p>
                  </div>
                </div>

                {/* Recent Failed Prestarts */}
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Recent Failed Prestarts</h3>
                  <div className="space-y-2">
                    {selectedWorker.all_prestarts
                      .filter((p) => p.overall_result === "Fail")
                      .slice(0, 5)
                      .map((p) => {
                        const vehicle = vehicleMap[p.vehicle_id];
                        return (
                          <div key={p.id} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{vehicle?.asset_code || "Unknown"}</p>
                                <p className="text-slate-600 dark:text-slate-400 text-xs">{p.client_name}</p>
                              </div>
                              <p className="text-xs text-slate-500">{format(new Date(p.prestart_datetime), "d MMM yyyy")}</p>
                            </div>
                          </div>
                        );
                      })}
                    {selectedWorker.all_prestarts.filter((p) => p.overall_result === "Fail").length === 0 && (
                      <p className="text-sm text-slate-500">No failed prestarts</p>
                    )}
                  </div>
                </div>

                {/* Incident History */}
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Incident History</h3>
                  <div className="space-y-2">
                    {selectedWorker.all_incidents.slice(0, 5).map((inc) => (
                      <div key={inc.id} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start mb-2">
                          <Badge
                            variant="outline"
                            className={
                              inc.incident_type === "HVNL Breach"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }
                          >
                            {inc.incident_type}
                          </Badge>
                          <p className="text-xs text-slate-500">{format(new Date(inc.incident_datetime), "d MMM yyyy")}</p>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{inc.description}</p>
                      </div>
                    ))}
                    {selectedWorker.all_incidents.length === 0 && (
                      <p className="text-sm text-slate-500">No incidents recorded</p>
                    )}
                  </div>
                </div>

                {/* Risk Controls Panel */}
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-xl p-4">
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Risk Controls & Actions
                  </h3>
                  <div className="space-y-3 text-sm">
                    {selectedWorker.risk_level === "Red" && (
                      <ul className="list-disc list-inside space-y-1 text-rose-700 dark:text-rose-400">
                        <li>Immediate safety review required</li>
                        <li>Implement supervision period</li>
                        <li>Mandatory training refresher</li>
                        <li>Document corrective actions</li>
                      </ul>
                    )}
                    {selectedWorker.risk_level === "Amber" && (
                      <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-400">
                        <li>Weekly check-ins with supervisor</li>
                        <li>Monitor prestart compliance</li>
                        <li>Targeted training as needed</li>
                      </ul>
                    )}
                    <Link to={createPageUrl(`WorkerRiskProfile?worker=${encodeURIComponent(selectedWorker.worker_name)}`)}>
                      <Button className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700">
                        View Full Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}