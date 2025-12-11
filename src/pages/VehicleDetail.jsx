import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
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

export default function VehicleDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const vehicleId = urlParams.get("id");

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

  const thirtyDaysAgo = subDays(new Date(), 30);
  const recentUsage = usageRecords.filter((u) => new Date(u.usage_date) >= thirtyDaysAgo);
  const totalHours30d = recentUsage.reduce((sum, u) => sum + (u.total_hours || 0), 0);
  const totalKm30d = recentUsage.reduce((sum, u) => sum + (u.km_travelled || 0), 0);
  const recentFuel = fuelTransactions.filter((f) => new Date(f.transaction_datetime) >= thirtyDaysAgo);
  const totalFuel30d = recentFuel.reduce((sum, f) => sum + (f.total_cost || 0), 0);

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
            <h1 className="text-2xl font-bold text-slate-900">{vehicle.asset_code}</h1>
            {getStatusBadge(vehicle.status)}
          </div>
          <p className="text-slate-500">{vehicle.rego} • {vehicle.asset_type}</p>
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
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
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
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
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
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-medium">30 Day Activity</span>
          </div>
          <p className="text-lg font-semibold">{Math.round(totalHours30d)} hrs</p>
          <p className="text-sm text-slate-500">{Math.round(totalKm30d).toLocaleString()} km</p>
        </div>

        {/* Fuel */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Fuel className="w-4 h-4" />
            <span className="text-sm font-medium">30 Day Fuel</span>
          </div>
          <p className="text-lg font-semibold">${totalFuel30d.toLocaleString()}</p>
          <p className="text-sm text-slate-500">{recentFuel.length} transactions</p>
        </div>
      </div>

      {/* Ownership Card (for hire vehicles) */}
      {vehicle.ownership_type !== "Owned" && (
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-violet-100">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-violet-600" />
            <h3 className="font-semibold text-violet-900">Hire Details</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-violet-600">Type</p>
              <p className="font-medium text-violet-900">{vehicle.ownership_type === "ContractHire" ? "Contract Hire" : "Day Hire"}</p>
            </div>
            <div>
              <p className="text-sm text-violet-600">Provider</p>
              <p className="font-medium text-violet-900">{hireProvider?.name || "-"}</p>
            </div>
            {contract && (
              <>
                <div>
                  <p className="text-sm text-violet-600">Contract</p>
                  <p className="font-medium text-violet-900">{contract.contract_name}</p>
                </div>
                <div>
                  <p className="text-sm text-violet-600">Rate</p>
                  <p className="font-medium text-violet-900">${contract.rate_amount} {contract.rate_basis?.replace("per_", "/")}</p>
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
          <TabsTrigger value="service" className="rounded-lg">Service</TabsTrigger>
          <TabsTrigger value="downtime" className="rounded-lg">Downtime</TabsTrigger>
          <TabsTrigger value="usage" className="rounded-lg">Usage</TabsTrigger>
          <TabsTrigger value="fuel" className="rounded-lg">Fuel</TabsTrigger>
        </TabsList>

        {/* Prestarts Tab */}
        <TabsContent value="prestarts">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                  <TableRow key={p.id} className="hover:bg-slate-50 cursor-pointer">
                    <TableCell>{format(new Date(p.prestart_datetime), "d MMM yyyy HH:mm")}</TableCell>
                    <TableCell>{p.operator_name}</TableCell>
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
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">No prestart records</TableCell>
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                  <TableRow key={s.id} className="hover:bg-slate-50">
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
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">No service records</TableCell>
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                  <TableRow key={d.id} className="hover:bg-slate-50">
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
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">No downtime events</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                  <TableRow key={u.id} className="hover:bg-slate-50">
                    <TableCell>{format(new Date(u.usage_date), "d MMM yyyy")}</TableCell>
                    <TableCell>{u.total_hours || "-"}</TableCell>
                    <TableCell>{u.km_travelled || "-"}</TableCell>
                    <TableCell>{u.jobs_count || "-"}</TableCell>
                    <TableCell>{u.project_code || "-"}</TableCell>
                  </TableRow>
                ))}
                {usageRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">No usage records</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Fuel Tab */}
        <TabsContent value="fuel">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                  <TableRow key={f.id} className="hover:bg-slate-50">
                    <TableCell>{format(new Date(f.transaction_datetime), "d MMM yyyy HH:mm")}</TableCell>
                    <TableCell>{f.litres?.toFixed(1)}L</TableCell>
                    <TableCell>${f.total_cost?.toFixed(2)}</TableCell>
                    <TableCell>{f.site_location || "-"}</TableCell>
                    <TableCell>{f.odometer_at_fill?.toLocaleString() || "-"}</TableCell>
                  </TableRow>
                ))}
                {fuelTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">No fuel transactions</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}