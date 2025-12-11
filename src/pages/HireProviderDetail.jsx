import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format, subDays } from "date-fns";
import {
  ArrowLeft,
  Building2,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  LineChart,
  Line,
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

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

export default function HireProviderDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const providerId = urlParams.get("id");

  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ["hireProvider", providerId],
    queryFn: () => base44.entities.HireProvider.filter({ id: providerId }),
    enabled: !!providerId,
    select: (data) => data[0],
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", providerId],
    queryFn: () => base44.entities.Vehicle.filter({ hire_provider_id: providerId }),
    enabled: !!providerId,
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["providerWorkOrders", providerId],
    queryFn: () => base44.entities.MaintenanceWorkOrder.list("-raised_datetime", 500),
    enabled: !!providerId,
  });

  const { data: downtimeEvents = [] } = useQuery({
    queryKey: ["providerDowntime", providerId],
    queryFn: () => base44.entities.AssetDowntimeEvent.list("-start_datetime", 500),
    enabled: !!providerId,
  });

  const { data: serviceRecords = [] } = useQuery({
    queryKey: ["providerServices", providerId],
    queryFn: () => base44.entities.ServiceRecord.list("-service_date", 500),
    enabled: !!providerId,
  });

  const { data: maintenancePlans = [] } = useQuery({
    queryKey: ["maintenancePlans"],
    queryFn: () => base44.entities.MaintenancePlan.list(),
  });

  const { data: maintenanceTemplates = [] } = useQuery({
    queryKey: ["maintenanceTemplates"],
    queryFn: () => base44.entities.MaintenanceTemplate.list(),
  });

  const vehicleIds = new Set(vehicles.map(v => v.id));

  const providerWorkOrders = workOrders.filter(wo => 
    wo.assigned_to_hire_provider_id === providerId || vehicleIds.has(wo.vehicle_id)
  );

  const providerDowntime = downtimeEvents.filter(d => 
    d.hire_provider_id === providerId || vehicleIds.has(d.vehicle_id)
  );

  const providerServices = serviceRecords.filter(s => 
    s.hire_provider_id === providerId || vehicleIds.has(s.vehicle_id)
  );

  // Calculate metrics
  const totalDowntime = providerDowntime.reduce((sum, d) => sum + (d.downtime_hours || 0), 0);
  const totalCost = providerServices.reduce((sum, s) => sum + (s.cost_ex_gst || 0), 0);
  
  const completedWOs = providerWorkOrders.filter(wo => wo.status === 'Completed').length;
  const totalWOs = providerWorkOrders.length;
  const onTimeRate = totalWOs > 0 ? Math.round((completedWOs / totalWOs) * 100) : 0;

  // HVNL Risk
  const templateMap = {};
  maintenanceTemplates.forEach(t => templateMap[t.id] = t);

  const hvnlOverdue = maintenancePlans.filter(plan => {
    if (!vehicleIds.has(plan.vehicle_id)) return false;
    if (plan.status !== 'Active') return false;
    const template = templateMap[plan.maintenance_template_id];
    if (!template?.hvnl_relevance_flag) return false;
    
    if (plan.next_due_date) {
      const dueDate = new Date(plan.next_due_date);
      if (dueDate < new Date()) return true;
    }
    return false;
  }).length;

  // Downtime by cause
  const downtimeByCause = {};
  providerDowntime.forEach(d => {
    const cause = d.cause_category || 'Other';
    if (!downtimeByCause[cause]) downtimeByCause[cause] = 0;
    downtimeByCause[cause] += d.downtime_hours || 0;
  });

  const downtimeByCauseData = Object.entries(downtimeByCause).map(([name, value]) => ({
    name: name.replace(/([A-Z])/g, ' $1').trim(),
    value: Math.round(value),
  }));

  // High-risk assets
  const ninetyDaysAgo = subDays(new Date(), 90);
  const assetRepairCount = {};
  workOrders
    .filter(wo => {
      const raisedDate = new Date(wo.raised_datetime);
      return raisedDate >= ninetyDaysAgo && (wo.work_order_type === 'Corrective' || wo.work_order_type === 'DefectRepair');
    })
    .forEach(wo => {
      if (!assetRepairCount[wo.vehicle_id]) assetRepairCount[wo.vehicle_id] = 0;
      assetRepairCount[wo.vehicle_id]++;
    });

  const assetDowntimeSum = {};
  providerDowntime.forEach(d => {
    if (!assetDowntimeSum[d.vehicle_id]) assetDowntimeSum[d.vehicle_id] = 0;
    assetDowntimeSum[d.vehicle_id] += d.downtime_hours || 0;
  });

  const highRiskAssets = vehicles.filter(v => 
    (assetRepairCount[v.id] || 0) > 2 || (assetDowntimeSum[v.id] || 0) > 24
  );

  if (providerLoading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-6 lg:p-8">
        <p>Provider not found</p>
      </div>
    );
  }

  const states = [...new Set(vehicles.map(v => v.state))];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to={createPageUrl("HireProviderPerformance")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            {provider.name}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Provider Performance Profile</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <Wrench className="w-4 h-4" />
            <span className="text-sm font-medium">Assets Managed</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{vehicles.length}</p>
          <p className="text-xs text-slate-500 mt-1">{states.join(', ')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Total Downtime</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(totalDowntime)}h</p>
          <p className="text-xs text-slate-500 mt-1">{providerDowntime.length} events</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">Completion Rate</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{onTimeRate}%</p>
          <p className="text-xs text-slate-500 mt-1">{completedWOs} / {totalWOs} WOs</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Total Service Cost</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${Math.round(totalCost).toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{providerServices.length} services</p>
        </div>
      </div>

      {/* Risk Flags */}
      {(hvnlOverdue > 0 || highRiskAssets.length > 0) && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30 rounded-2xl p-6 mb-6 border border-rose-100 dark:border-rose-900">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="font-semibold text-rose-900 dark:text-rose-200">Risk Alerts</h3>
          </div>
          <div className="flex gap-4">
            {hvnlOverdue > 0 && (
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                {hvnlOverdue} HVNL Overdue
              </Badge>
            )}
            {highRiskAssets.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {highRiskAssets.length} High-Risk Assets
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Downtime by Cause */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Downtime by Cause
          </h2>
          {downtimeByCauseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={downtimeByCauseData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}h`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {downtimeByCauseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-500 py-16">No downtime data</p>
          )}
        </div>

        {/* Placeholder for trend */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Provider Contact
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Primary Contact</p>
              <p className="font-medium">{provider.contact_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Phone</p>
              <p className="font-medium">{provider.contact_phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="font-medium">{provider.contact_email || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Work Order History */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Work Order History</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providerWorkOrders.slice(0, 20).map((wo) => {
                const vehicle = vehicles.find(v => v.id === wo.vehicle_id);
                return (
                  <TableRow key={wo.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <TableCell className="font-medium">{vehicle?.asset_code || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-100">{wo.work_order_type}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(wo.raised_datetime), "d MMM yyyy")}</TableCell>
                    <TableCell>{wo.due_date ? format(new Date(wo.due_date), "d MMM yyyy") : '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          wo.status === 'Completed'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : wo.status === 'InProgress'
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }
                      >
                        {wo.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={wo.priority === 'SafetyCritical' ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100"}
                      >
                        {wo.priority}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {providerWorkOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No work orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* High-Risk Assets */}
      {highRiskAssets.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              High-Risk Assets
            </h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                  <TableHead>Asset Code</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Corrective Repairs (90d)</TableHead>
                  <TableHead>Total Downtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRiskAssets.map((vehicle) => (
                  <TableRow key={vehicle.id} className="bg-rose-50/30 dark:bg-rose-900/10">
                    <TableCell className="font-medium">
                      <Link
                        to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}
                        className="text-indigo-600 hover:underline"
                      >
                        {vehicle.asset_code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-100">{vehicle.state}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        {assetRepairCount[vehicle.id] || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-rose-600">
                        {Math.round(assetDowntimeSum[vehicle.id] || 0)}h
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}