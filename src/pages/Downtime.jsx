import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import { Search, Filter, Download, Plus, Clock } from "lucide-react";
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

export default function Downtime() {
  const [filters, setFilters] = useState({
    search: "",
    state: "all",
    reason: "all",
    caused_by: "all",
  });

  const { data: downtimeEvents = [], isLoading } = useQuery({
    queryKey: ["downtimeEvents"],
    queryFn: () => base44.entities.AssetDowntimeEvent.list("-start_datetime", 500),
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

  const filteredEvents = useMemo(() => {
    return downtimeEvents.filter((d) => {
      const vehicle = vehicleMap[d.vehicle_id];

      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !vehicle?.asset_code?.toLowerCase().includes(search) &&
          !vehicle?.rego?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      if (filters.state !== "all" && vehicle?.state !== filters.state) return false;
      if (filters.reason !== "all" && d.reason !== filters.reason) return false;
      if (filters.caused_by !== "all" && d.caused_by !== filters.caused_by) return false;

      return true;
    });
  }, [downtimeEvents, filters, vehicleMap]);

  const totalHours = filteredEvents.reduce((sum, d) => sum + (d.downtime_hours || 0), 0);
  const standDownExpected = filteredEvents.filter((d) => d.stand_down_expected).length;
  const standDownConfirmed = filteredEvents.filter((d) => d.stand_down_confirmed).length;

  const exportToCSV = () => {
    const headers = ["Start", "End", "Asset Code", "Reason", "Caused By", "Hours", "Stand Down Expected", "Stand Down Confirmed"];
    const rows = filteredEvents.map((d) => {
      const vehicle = vehicleMap[d.vehicle_id];
      return [
        d.start_datetime ? format(new Date(d.start_datetime), "yyyy-MM-dd HH:mm") : "",
        d.end_datetime ? format(new Date(d.end_datetime), "yyyy-MM-dd HH:mm") : "",
        vehicle?.asset_code || "",
        d.reason,
        d.caused_by,
        d.downtime_hours || 0,
        d.stand_down_expected ? "Yes" : "No",
        d.stand_down_confirmed ? "Yes" : "No",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `downtime-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getReasonBadge = (reason) => {
    const colors = {
      Service: "bg-blue-50 text-blue-700 border-blue-200",
      Breakdown: "bg-rose-50 text-rose-700 border-rose-200",
      Accident: "bg-red-50 text-red-700 border-red-200",
      ClientHold: "bg-amber-50 text-amber-700 border-amber-200",
      AwaitingParts: "bg-orange-50 text-orange-700 border-orange-200",
    };
    return (
      <Badge variant="outline" className={colors[reason] || colors.Service}>
        {reason}
      </Badge>
    );
  };

  const getCausedByBadge = (causedBy) => {
    const colors = {
      KPI: "bg-indigo-50 text-indigo-700 border-indigo-200",
      HireProvider: "bg-violet-50 text-violet-700 border-violet-200",
      Client: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Unknown: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return (
      <Badge variant="outline" className={colors[causedBy] || colors.Unknown}>
        {causedBy}
      </Badge>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Downtime Events</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{filteredEvents.length} events</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Link to={createPageUrl("DowntimeForm")}>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Log Downtime
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Events</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{filteredEvents.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Hours</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(totalHours)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Stand-Down Expected</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{standDownExpected}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Stand-Down Confirmed</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{standDownConfirmed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by asset..."
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
            <Select value={filters.reason} onValueChange={(v) => setFilters({ ...filters, reason: v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="Service">Service</SelectItem>
                <SelectItem value="Breakdown">Breakdown</SelectItem>
                <SelectItem value="Accident">Accident</SelectItem>
                <SelectItem value="ClientHold">Client Hold</SelectItem>
                <SelectItem value="AwaitingParts">Awaiting Parts</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.caused_by} onValueChange={(v) => setFilters({ ...filters, caused_by: v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Caused By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="KPI">KPI</SelectItem>
                <SelectItem value="HireProvider">Hire Provider</SelectItem>
                <SelectItem value="Client">Client</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
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
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Caused By</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Stand-Down</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((d) => {
                const vehicle = vehicleMap[d.vehicle_id];
                return (
                  <TableRow key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                    <TableCell className="font-medium">
                      {format(new Date(d.start_datetime), "d MMM HH:mm")}
                    </TableCell>
                    <TableCell>
                      {d.end_datetime ? format(new Date(d.end_datetime), "d MMM HH:mm") : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Ongoing
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={createPageUrl(`VehicleDetail?id=${d.vehicle_id}`)}
                        className="text-indigo-600 hover:underline"
                      >
                        {vehicle?.asset_code || "-"}
                      </Link>
                    </TableCell>
                    <TableCell>{getReasonBadge(d.reason)}</TableCell>
                    <TableCell>{getCausedByBadge(d.caused_by)}</TableCell>
                    <TableCell className="font-medium">{d.downtime_hours || "-"}</TableCell>
                    <TableCell>
                      {d.stand_down_expected && (
                        <Badge
                          variant="outline"
                          className={
                            d.stand_down_confirmed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {d.stand_down_confirmed ? "Confirmed" : "Expected"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredEvents.length === 0 && (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No downtime events found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}