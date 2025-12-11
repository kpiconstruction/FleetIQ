import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format, subDays } from "date-fns";
import {
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Building2,
  TrendingUp,
  Download,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";

export default function HireProviderPerformance() {
  const [filters, setFilters] = useState({
    dateRangeStart: format(subDays(new Date(), 90), "yyyy-MM-dd"),
    dateRangeEnd: format(new Date(), "yyyy-MM-dd"),
    state: "all",
    functionClass: "all",
    provider: "all",
    hvnlRelevance: "all",
    downtimeCauseCategory: "all",
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  const { data: performanceData, isLoading } = useQuery({
    queryKey: [
      "hireProviderPerformance",
      filters.dateRangeStart,
      filters.dateRangeEnd,
      filters.state,
      filters.functionClass,
      filters.provider,
      filters.hvnlRelevance,
      filters.downtimeCauseCategory,
    ],
    queryFn: async () => {
      const response = await base44.functions.invoke("getHireProviderPerformanceAggregates", {
        dateRangeStart: filters.dateRangeStart,
        dateRangeEnd: filters.dateRangeEnd,
        stateFilter: filters.state,
        functionClassFilter: filters.functionClass,
        providerFilter: filters.provider,
        hvnlRelevance: filters.hvnlRelevance,
        downtimeCauseCategory: filters.downtimeCauseCategory,
      });
      return response.data;
    },
  });

  const downtimeByProviderData = useMemo(() => {
    if (!performanceData?.providers) return [];
    return performanceData.providers
      .filter(p => p.total_downtime_hours > 0)
      .slice(0, 10)
      .map(p => ({
        name: p.provider_name,
        hours: p.total_downtime_hours,
        events: p.downtime_events_count,
      }));
  }, [performanceData]);

  const costByProviderData = useMemo(() => {
    if (!performanceData?.providers) return [];
    return performanceData.providers
      .filter(p => p.total_service_cost > 0)
      .slice(0, 10)
      .map(p => ({
        name: p.provider_name,
        cost: p.total_service_cost,
        services: p.service_count,
      }));
  }, [performanceData]);

  const turnaroundScatterData = useMemo(() => {
    if (!performanceData?.providers) return [];
    return performanceData.providers
      .filter(p => p.work_orders_completed > 0)
      .map(p => ({
        name: p.provider_name,
        turnaround: p.avg_repair_turnaround_hours,
        completed: p.work_orders_completed,
      }));
  }, [performanceData]);

  const exportToCSV = () => {
    if (!performanceData?.providers) return;
    
    const headers = [
      "Provider",
      "Asset Count",
      "Downtime Hours",
      "Avg Turnaround (hrs)",
      "On-Time Rate %",
      "HVNL Overdue",
      "Service Cost",
      "Repeat Defects",
      "Risk Score",
    ];
    
    const rows = performanceData.providers.map(p => [
      p.provider_name,
      p.asset_count,
      p.total_downtime_hours,
      p.avg_repair_turnaround_hours,
      p.on_time_completion_rate,
      p.hvnl_overdue_count,
      p.total_service_cost,
      p.repeat_defect_count,
      p.risk_score,
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hire-provider-performance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getRiskBadge = (riskLevel, riskScore) => {
    const styles = {
      High: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50",
      Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50",
      Low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50",
    };

    return (
      <Badge variant="outline" className={styles[riskLevel]}>
        {riskLevel} ({riskScore})
      </Badge>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Hire Provider Performance
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Reliability, downtime, cost & compliance metrics
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={isLoading}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <div className="lg:col-span-2">
            <Label>Date Range</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.dateRangeStart}
                onChange={(e) => setFilters({ ...filters, dateRangeStart: e.target.value })}
              />
              <Input
                type="date"
                value={filters.dateRangeEnd}
                onChange={(e) => setFilters({ ...filters, dateRangeEnd: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>State</Label>
            <Select value={filters.state} onValueChange={(v) => setFilters({ ...filters, state: v })}>
              <SelectTrigger>
                <SelectValue />
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
          </div>

          <div>
            <Label>Function Class</Label>
            <Select value={filters.functionClass} onValueChange={(v) => setFilters({ ...filters, functionClass: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="TMA">TMA</SelectItem>
                <SelectItem value="PodTruckTruck">Pod Truck</SelectItem>
                <SelectItem value="TrafficUte">Traffic Ute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Provider</Label>
            <Select value={filters.provider} onValueChange={(v) => setFilters({ ...filters, provider: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {hireProviders.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>HVNL Relevance</Label>
            <Select value={filters.hvnlRelevance} onValueChange={(v) => setFilters({ ...filters, hvnlRelevance: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assets</SelectItem>
                <SelectItem value="hvnl_only">HVNL Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Downtime Cause</Label>
            <Select value={filters.downtimeCauseCategory} onValueChange={(v) => setFilters({ ...filters, downtimeCauseCategory: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Causes</SelectItem>
                <SelectItem value="HireProviderDelay">Provider Delay</SelectItem>
                <SelectItem value="PartsDelay">Parts Delay</SelectItem>
                <SelectItem value="CorrectiveRepair">Corrective</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30 rounded-2xl p-5 border border-rose-100 dark:border-rose-900">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-8 h-8 text-rose-600" />
            </div>
            <p className="text-sm text-rose-600 dark:text-rose-400 font-medium mb-1">Total Downtime</p>
            <p className="text-3xl font-bold text-rose-900 dark:text-rose-200">
              {performanceData?.summary?.total_downtime_hours || 0}h
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-5 border border-blue-100 dark:border-blue-900">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Avg Turnaround</p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-200">
              {performanceData?.providers?.length > 0
                ? Math.round(performanceData.providers.reduce((sum, p) => sum + p.avg_repair_turnaround_hours, 0) / performanceData.providers.length)
                : 0}h
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-1">Avg On-Time Rate</p>
            <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-200">
              {performanceData?.summary?.avg_on_time_rate || 0}%
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-5 border border-amber-100 dark:border-amber-900">
            <div className="flex items-center justify-between mb-3">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mb-1">HVNL Overdue</p>
            <p className="text-3xl font-bold text-amber-900 dark:text-amber-200">
              {performanceData?.summary?.total_hvnl_overdue || 0}
            </p>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-2xl p-5 border border-violet-100 dark:border-violet-900">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="w-8 h-8 text-violet-600" />
            </div>
            <p className="text-sm text-violet-600 dark:text-violet-400 font-medium mb-1">Total Service Cost</p>
            <p className="text-3xl font-bold text-violet-900 dark:text-violet-200">
              ${(performanceData?.summary?.total_service_cost || 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Provider Performance Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Provider Performance Summary
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {performanceData?.providers?.length || 0} active providers
          </p>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead>Provider</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Downtime</TableHead>
                  <TableHead>Avg Turnaround</TableHead>
                  <TableHead>On-Time %</TableHead>
                  <TableHead>HVNL Overdue</TableHead>
                  <TableHead>Service Cost</TableHead>
                  <TableHead>Repeat Defects</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceData?.providers?.map((provider) => (
                  <TableRow
                    key={provider.provider_id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                      provider.risk_level === 'High' ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''
                    }`}
                  >
                    <TableCell className="font-medium">
                      {provider.provider_name}
                      <p className="text-xs text-slate-500">
                        {provider.states.join(', ') || 'N/A'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800">
                        {provider.asset_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{provider.total_downtime_hours}h</p>
                        <p className="text-xs text-slate-500">{provider.downtime_events_count} events</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={provider.avg_repair_turnaround_hours > 48 ? 'text-rose-600 font-semibold' : ''}>
                        {provider.avg_repair_turnaround_hours}h
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          provider.on_time_completion_rate >= 80
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : provider.on_time_completion_rate >= 60
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }
                      >
                        {provider.on_time_completion_rate}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {provider.hvnl_overdue_count > 0 ? (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {provider.hvnl_overdue_count}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-indigo-600">
                      ${provider.total_service_cost.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {provider.repeat_defect_count > 0 ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          {provider.repeat_defect_count}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getRiskBadge(provider.risk_level, provider.risk_score)}
                    </TableCell>
                    <TableCell>
                      <Link to={createPageUrl(`HireProviderDetail?id=${provider.provider_id}`)}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {(!performanceData?.providers || performanceData.providers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-500 dark:text-slate-400">
                      No provider data for selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Charts */}
      {!isLoading && performanceData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Downtime by Provider */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Downtime by Provider
            </h2>
            {downtimeByProviderData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={downtimeByProviderData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#f59e0b" name="Downtime Hours" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-slate-500 py-16">No downtime data</p>
            )}
          </div>

          {/* Cost by Provider */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Maintenance Cost by Provider
            </h2>
            {costByProviderData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costByProviderData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="cost" fill="#8b5cf6" name="Service Cost ($)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-slate-500 py-16">No cost data</p>
            )}
          </div>
        </div>
      )}

      {/* Turnaround Scatter */}
      {!isLoading && turnaroundScatterData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Work Order Turnaround Time
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="completed" stroke="#64748b" name="Completed WOs" />
              <YAxis dataKey="turnaround" stroke="#64748b" name="Avg Hours" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Providers" data={turnaroundScatterData} fill="#6366f1" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}