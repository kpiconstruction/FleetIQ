import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import { Search, Filter, Download, Activity } from "lucide-react";
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

export default function Usage() {
  const [filters, setFilters] = useState({
    search: "",
    state: "all",
    ownership_type: "all",
  });

  const { data: usageRecords = [], isLoading } = useQuery({
    queryKey: ["usageRecords"],
    queryFn: () => base44.entities.UsageRecord.list("-usage_date", 500),
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
    return usageRecords.filter((u) => {
      const vehicle = vehicleMap[u.vehicle_id];

      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !vehicle?.asset_code?.toLowerCase().includes(search) &&
          !vehicle?.rego?.toLowerCase().includes(search) &&
          !u.project_code?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      if (filters.state !== "all" && vehicle?.state !== filters.state) return false;
      if (filters.ownership_type !== "all" && (u.ownership_type_snapshot || vehicle?.ownership_type) !== filters.ownership_type) return false;

      return true;
    });
  }, [usageRecords, filters, vehicleMap]);

  const totalHours = filteredRecords.reduce((sum, u) => sum + (u.total_hours || 0), 0);
  const totalKm = filteredRecords.reduce((sum, u) => sum + (u.km_travelled || 0), 0);
  const totalJobs = filteredRecords.reduce((sum, u) => sum + (u.jobs_count || 0), 0);

  const exportToCSV = () => {
    const headers = ["Date", "Asset Code", "Hours", "Km", "Jobs", "Project", "Offline", "Source"];
    const rows = filteredRecords.map((u) => {
      const vehicle = vehicleMap[u.vehicle_id];
      return [
        u.usage_date,
        vehicle?.asset_code || "",
        u.total_hours || 0,
        u.km_travelled || 0,
        u.jobs_count || 0,
        u.project_code || "",
        u.is_offline ? "Yes" : "No",
        u.source || "",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Usage Records</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{filteredRecords.length} records</p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Hours</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(totalHours).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Kilometres</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(totalKm).toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Jobs</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalJobs.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by asset, project..."
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
            <Select value={filters.ownership_type} onValueChange={(v) => setFilters({ ...filters, ownership_type: v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Ownership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ownership</SelectItem>
                <SelectItem value="Owned">Owned</SelectItem>
                <SelectItem value="ContractHire">Contract Hire</SelectItem>
                <SelectItem value="DayHire">Day Hire</SelectItem>
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Date</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Km</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((u) => {
                const vehicle = vehicleMap[u.vehicle_id];
                return (
                  <TableRow key={u.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      {format(new Date(u.usage_date), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={createPageUrl(`VehicleDetail?id=${u.vehicle_id}`)}
                        className="text-indigo-600 hover:underline"
                      >
                        {vehicle?.asset_code || "-"}
                      </Link>
                    </TableCell>
                    <TableCell>{u.total_hours || "-"}</TableCell>
                    <TableCell>{u.km_travelled || "-"}</TableCell>
                    <TableCell>{u.jobs_count || "-"}</TableCell>
                    <TableCell className="text-slate-600">{u.project_code || "-"}</TableCell>
                    <TableCell>
                      {u.is_offline ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Offline
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500">{u.source || "Manual"}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredRecords.length === 0 && (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No usage records found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}