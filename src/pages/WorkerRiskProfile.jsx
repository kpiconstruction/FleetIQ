import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format, subDays, subMonths } from "date-fns";
import {
  ArrowLeft,
  User,
  AlertTriangle,
  TrendingUp,
  XCircle,
  CheckCircle,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function WorkerRiskProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const workerName = urlParams.get("worker");

  const { data: prestarts = [], isLoading: prestartsLoading } = useQuery({
    queryKey: ["prestarts"],
    queryFn: () => base44.entities.PrestartCheck.list("-prestart_datetime", 1000),
  });

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => base44.entities.IncidentRecord.list("-incident_datetime", 500),
  });

  const { data: defects = [] } = useQuery({
    queryKey: ["defects"],
    queryFn: () => base44.entities.PrestartDefect.list("-reported_at", 500),
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

  const workerData = useMemo(() => {
    const now = new Date();
    const ninetyDaysAgo = subDays(now, 90);
    const twelveMonthsAgo = subDays(now, 365);

    const workerPrestarts = prestarts.filter(
      (p) => (p.worker_name || p.operator_name) === workerName
    );

    const workerIncidents = incidents.filter(
      (inc) => inc.driver_name === workerName
    );

    const failedPrestarts = workerPrestarts.filter((p) => {
      const date = new Date(p.prestart_datetime);
      return p.overall_result === "Fail" && date >= ninetyDaysAgo;
    });

    const recentIncidents = workerIncidents.filter((inc) => {
      const date = new Date(inc.incident_datetime);
      return date >= twelveMonthsAgo;
    });

    const hvnlIncidents = recentIncidents.filter(
      (inc) => inc.incident_type === "HVNL Breach"
    );

    const criticalDefects = defects.filter((d) => {
      const prestart = prestarts.find((p) => p.id === d.prestart_id);
      if (!prestart || (prestart.worker_name || prestart.operator_name) !== workerName) return false;
      const date = new Date(d.reported_at || prestart.prestart_datetime);
      return d.severity === "Critical" && date >= ninetyDaysAgo;
    });

    // Calculate risk level
    let riskScore = 0;
    if (failedPrestarts.length >= 5) riskScore += 2;
    else if (failedPrestarts.length >= 3) riskScore += 1;

    if (criticalDefects.length >= 3) riskScore += 2;
    else if (criticalDefects.length >= 2) riskScore += 1;

    if (recentIncidents.length >= 2) riskScore += 3;
    else if (recentIncidents.length >= 1) riskScore += 1;

    if (hvnlIncidents.length >= 1) riskScore += 3;

    let riskLevel = "Green";
    if (riskScore >= 5) riskLevel = "Red";
    else if (riskScore >= 3) riskLevel = "Amber";

    return {
      workerPrestarts,
      workerIncidents,
      failedPrestarts,
      recentIncidents,
      hvnlIncidents,
      criticalDefects,
      riskLevel,
      riskScore,
    };
  }, [prestarts, incidents, defects, workerName]);

  // 12-month trend data
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = subMonths(new Date(), i);
      const monthEnd = subMonths(new Date(), i - 1);

      const monthPrestarts = workerData.workerPrestarts.filter((p) => {
        const date = new Date(p.prestart_datetime);
        return date >= monthStart && date < monthEnd;
      });

      const monthIncidents = workerData.workerIncidents.filter((inc) => {
        const date = new Date(inc.incident_datetime);
        return date >= monthStart && date < monthEnd;
      });

      const failedCount = monthPrestarts.filter((p) => p.overall_result === "Fail").length;

      months.push({
        month: format(monthStart, "MMM yy"),
        failed_prestarts: failedCount,
        incidents: monthIncidents.length,
        total_prestarts: monthPrestarts.length,
      });
    }
    return months;
  }, [workerData]);

  const getRiskBadge = (level) => {
    const styles = {
      Red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400",
      Amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400",
      Green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400",
    };
    return (
      <Badge variant="outline" className={`text-lg px-4 py-2 ${styles[level]}`}>
        {level === "Red" && <AlertTriangle className="w-4 h-4 mr-2" />}
        {level} Risk
      </Badge>
    );
  };

  if (prestartsLoading || incidentsLoading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!workerName) {
    return (
      <div className="p-6 lg:p-8">
        <p>Worker not specified</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{workerName}</h1>
            {getRiskBadge(workerData.riskLevel)}
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Worker Risk Profile & Safety Record</p>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Failed Prestarts</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{workerData.failedPrestarts.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Last 90 days</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Critical Defects</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{workerData.criticalDefects.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Last 90 days</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Incidents</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{workerData.recentIncidents.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Last 12 months</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-rose-100 dark:border-rose-900">
          <p className="text-sm text-rose-600 dark:text-rose-400 mb-1">HVNL Breaches</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{workerData.hvnlIncidents.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Last 12 months</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Prestarts</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{workerData.workerPrestarts.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">All time</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Risk Score</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{workerData.riskScore}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Calculated</p>
        </div>
      </div>

      {/* 12-Month Trend Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          12-Month Trend
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="failed_prestarts" stroke="#ef4444" strokeWidth={2} name="Failed Prestarts" />
            <Line type="monotone" dataKey="incidents" stroke="#f59e0b" strokeWidth={2} name="Incidents" />
            <Line type="monotone" dataKey="total_prestarts" stroke="#3b82f6" strokeWidth={2} name="Total Prestarts" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prestarts" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="prestarts" className="rounded-lg">
            Failed Prestarts ({workerData.failedPrestarts.length})
          </TabsTrigger>
          <TabsTrigger value="incidents" className="rounded-lg">
            Incidents ({workerData.recentIncidents.length})
          </TabsTrigger>
          <TabsTrigger value="hvnl" className="rounded-lg">
            HVNL Breaches ({workerData.hvnlIncidents.length})
          </TabsTrigger>
          <TabsTrigger value="controls" className="rounded-lg">
            Risk Controls
          </TabsTrigger>
        </TabsList>

        {/* Failed Prestarts Tab */}
        <TabsContent value="prestarts">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Client/Project</TableHead>
                  <TableHead>Defects</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerData.failedPrestarts.map((p) => {
                  const vehicle = vehicleMap[p.vehicle_id];
                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <TableCell>{format(new Date(p.prestart_datetime), "d MMM yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`VehicleDetail?id=${p.vehicle_id}`)} className="text-indigo-600 hover:underline">
                          {vehicle?.asset_code || "-"}
                        </Link>
                      </TableCell>
                      <TableCell>{p.prestart_type}</TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {p.client_name || "-"}
                        {p.project_name && <div className="text-xs">{p.project_name}</div>}
                      </TableCell>
                      <TableCell>
                        {p.defect_count > 0 && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            {p.defect_count}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                          <XCircle className="w-3 h-3 mr-1" />
                          Fail
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {workerData.failedPrestarts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">
                      No failed prestarts in the last 90 days
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Incidents Tab */}
        <TabsContent value="incidents">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerData.recentIncidents.map((inc) => (
                  <TableRow key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <TableCell>{format(new Date(inc.incident_datetime), "d MMM yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        inc.incident_type === "HVNL Breach"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }>
                        {inc.incident_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        inc.severity === "Critical" || inc.severity === "Serious"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200"
                      }>
                        {inc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{inc.description}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{inc.location || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{inc.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {workerData.recentIncidents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400">
                      No incidents in the last 12 months
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* HVNL Tab */}
        <TabsContent value="hvnl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Breach Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Investigation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerData.hvnlIncidents.map((inc) => (
                  <TableRow key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <TableCell>{format(new Date(inc.incident_datetime), "d MMM yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                        {inc.hvnl_breach_type || "General HVNL"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-semibold">
                        {inc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">{inc.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        inc.investigation_status === "Completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }>
                        {inc.investigation_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{inc.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {workerData.hvnlIncidents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-emerald-300 dark:text-emerald-700 mx-auto mb-2" />
                      <p className="text-slate-500 dark:text-slate-400">No HVNL breaches recorded</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Risk Controls Tab */}
        <TabsContent value="controls">
          <div className="grid gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recommended Risk Controls</h3>
              </div>
              
              <div className="space-y-4">
                {workerData.riskLevel === "Red" && (
                  <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-4">
                    <p className="font-medium text-rose-900 dark:text-rose-200 mb-2">Immediate Actions Required</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-rose-700 dark:text-rose-400">
                      <li>Suspend from high-risk operations until review completed</li>
                      <li>Conduct formal safety interview and training refresher</li>
                      <li>Implement supervised operations period (minimum 2 weeks)</li>
                      <li>Review and document all incidents and corrective actions</li>
                    </ul>
                  </div>
                )}

                {workerData.failedPrestarts.length >= 3 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4">
                    <p className="font-medium text-amber-900 dark:text-amber-200 mb-2">Prestart Performance</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-700 dark:text-amber-400">
                      <li>Mandatory prestart training refresher</li>
                      <li>Additional supervision for next 10 prestarts</li>
                      <li>Review vehicle familiarity and equipment knowledge</li>
                    </ul>
                  </div>
                )}

                {workerData.hvnlIncidents.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-4">
                    <p className="font-medium text-red-900 dark:text-red-200 mb-2">HVNL Compliance</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-400">
                      <li>Formal HVNL training and certification review</li>
                      <li>Implement fatigue management monitoring</li>
                      <li>Review work scheduling and rostering patterns</li>
                      <li>Potential regulatory reporting obligations</li>
                    </ul>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-4">
                  <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">Ongoing Monitoring</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-400">
                    <li>Weekly safety check-ins with supervisor</li>
                    <li>Monthly performance review meetings</li>
                    <li>Monitor prestart compliance daily</li>
                    <li>Quarterly risk reassessment</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}