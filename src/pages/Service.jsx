import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import { Search, Filter, Download, Plus, Wrench } from "lucide-react";
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

export default function Service() {
  const [filters, setFilters] = useState({
    search: "",
    state: "all",
    service_type: "all",
    chargeable_to: "all",
  });

  const { data: serviceRecords = [], isLoading } = useQuery({
    queryKey: ["serviceRecords"],
    queryFn: () => base44.entities.ServiceRecord.list("-service_date", 500),
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

  const filteredRecords = useMemo(() => {
    return serviceRecords.filter((s) => {
      const vehicle = vehicleMap[s.vehicle_id];

      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !vehicle?.asset_code?.toLowerCase().includes(search) &&
          !vehicle?.rego?.toLowerCase().includes(search) &&
          !s.workshop_name?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      if (filters.state !== "all" && vehicle?.state !== filters.state) return false;
      if (filters.service_type !== "all" && s.service_type !== filters.service_type) return false;
      if (filters.chargeable_to !== "all" && s.downtime_chargeable_to !== filters.chargeable_to) return false;

      return true;
    });
  }, [serviceRecords, filters, vehicleMap]);

  const totalCost = filteredRecords.reduce((sum, s) => sum + (s.cost_ex_gst || 0), 0);
  const totalDowntime = filteredRecords.reduce((sum, s) => sum + (s.downtime_hours || 0), 0);

  const exportToCSV = () => {
    const headers = ["Date", "Asset Code", "Type", "Workshop", "Cost", "Downtime Hours", "Chargeable To", "Notes"];
    const rows = filteredRecords.map((s) => {
      const vehicle = vehicleMap[s.vehicle_id];
      return [
        s.service_date,
        vehicle?.asset_code || "",
        s.service_type,
        s.workshop_name || "",
        s.cost_ex_gst || 0,
        s.downtime_hours || 0,
        s.downtime_chargeable_to || "",
        s.notes || "",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service-records-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getServiceTypeBadge = (type) => {
    const colors = {
      Scheduled: "bg-blue-50 text-blue-700 border-blue-200",
      Unscheduled: "bg-amber-50 text-amber-700 border-amber-200",
      Breakdown: "bg-rose-50 text-rose-700 border-rose-200",
      Warranty: "bg-emerald-50 text-emerald-700 border-emerald-200",
      HireProviderService: "bg-violet-50 text-violet-700 border-violet-200",
    };
    return (
      <Badge variant="outline" className={colors[type] || colors.Scheduled}>
        {type}
      </Badge>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Service Records</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{filteredRecords.length} records</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Link to={createPageUrl("ServiceForm")}>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Service Record
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Records</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{filteredRecords.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Cost (ex GST)</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${totalCost.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Downtime</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(totalDowntime)} hours</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by asset, workshop..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={filters.state} onValueChange={(v) => setFilters({ ...filters, state: v })}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="VIC">VIC</SelectItem>
                <SelectItem value="NSW">NSW</SelectItem>
                <SelectItem value="QLD">QLD</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.service_type} onValueChange={(v) => setFilters({ ...filters, service_type: v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Unscheduled">Unscheduled</SelectItem>
                <SelectItem value="Breakdown">Breakdown</SelectItem>
                <SelectItem value="Warranty">Warranty</SelectItem>
                <SelectItem value="HireProviderService">Hire Provider</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.chargeable_to} onValueChange={(v) => setFilters({ ...filters, chargeable_to: v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Chargeable To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="KPI">KPI</SelectItem>
                <SelectItem value="HireProvider">Hire Provider</SelectItem>
                <SelectItem value="Client">Client</SelectItem>
                <SelectItem value="Shared">Shared</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
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
              <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                <TableHead>Date</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Workshop</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Downtime</TableHead>
                <TableHead>Chargeable To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((s) => {
                const vehicle = vehicleMap[s.vehicle_id];
                return (
                  <TableRow key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                    <TableCell className="font-medium">
                      {format(new Date(s.service_date), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={createPageUrl(`VehicleDetail?id=${s.vehicle_id}`)}
                        className="text-indigo-600 hover:underline"
                      >
                        {vehicle?.asset_code || "-"}
                      </Link>
                    </TableCell>
                    <TableCell>{getServiceTypeBadge(s.service_type)}</TableCell>
                    <TableCell className="text-slate-600">{s.workshop_name || "-"}</TableCell>
                    <TableCell className="font-medium">
                      ${(s.cost_ex_gst || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>{s.downtime_hours ? `${s.downtime_hours}h` : "-"}</TableCell>
                    <TableCell>{s.downtime_chargeable_to || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredRecords.length === 0 && (
            <div className="p-12 text-center">
              <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No service records found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}