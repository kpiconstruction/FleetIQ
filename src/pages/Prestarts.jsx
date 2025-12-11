import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import { Search, Filter, Download, Eye, CheckCircle, XCircle } from "lucide-react";
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

export default function Prestarts() {
  const [filters, setFilters] = useState({
    search: "",
    state: "all",
    result: "all",
    type: "all",
  });

  const { data: prestarts = [], isLoading } = useQuery({
    queryKey: ["prestarts"],
    queryFn: () => base44.entities.PrestartCheck.list("-prestart_datetime", 500),
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

  const filteredPrestarts = useMemo(() => {
    return prestarts.filter((p) => {
      const vehicle = vehicleMap[p.vehicle_id];
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !p.operator_name?.toLowerCase().includes(search) &&
          !vehicle?.asset_code?.toLowerCase().includes(search) &&
          !vehicle?.rego?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      if (filters.state !== "all" && vehicle?.state !== filters.state) return false;
      if (filters.result !== "all" && p.overall_result !== filters.result) return false;
      if (filters.type !== "all" && p.prestart_type !== filters.type) return false;

      return true;
    });
  }, [prestarts, filters, vehicleMap]);

  const exportToCSV = () => {
    const headers = ["Date", "Asset Code", "Operator", "Type", "Result", "Defects", "Client", "Project"];
    const rows = filteredPrestarts.map((p) => {
      const vehicle = vehicleMap[p.vehicle_id];
      return [
        format(new Date(p.prestart_datetime), "yyyy-MM-dd HH:mm"),
        vehicle?.asset_code || "",
        p.operator_name,
        p.prestart_type,
        p.overall_result,
        p.defect_count || 0,
        p.client_name || "",
        p.project_name || "",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestarts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Prestarts</h1>
          <p className="text-slate-500 mt-1">{filteredPrestarts.length} prestart records</p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by operator, asset..."
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
            <Select value={filters.result} onValueChange={(v) => setFilters({ ...filters, result: v })}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="Pass">Pass</SelectItem>
                <SelectItem value="Fail">Fail</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="TMA">TMA</SelectItem>
                <SelectItem value="Vehicle">Vehicle</SelectItem>
                <SelectItem value="Pod Truck">Pod Truck</SelectItem>
                <SelectItem value="Plant">Plant</SelectItem>
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
                <TableHead>Date/Time</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Client/Project</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Defects</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrestarts.map((p) => {
                const vehicle = vehicleMap[p.vehicle_id];
                return (
                  <TableRow key={p.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      {format(new Date(p.prestart_datetime), "d MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{vehicle?.asset_code || "-"}</p>
                        <p className="text-sm text-slate-500">{vehicle?.rego}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {p.prestart_type}
                      </span>
                    </TableCell>
                    <TableCell>{p.operator_name}</TableCell>
                    <TableCell className="text-slate-600">
                      {p.client_name && <div>{p.client_name}</div>}
                      {p.project_name && <div className="text-sm">{p.project_name}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          p.overall_result === "Pass"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }
                      >
                        {p.overall_result === "Pass" ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {p.overall_result}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.defect_count > 0 ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          {p.defect_count}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to={createPageUrl(`PrestartDetail?id=${p.id}`)}>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredPrestarts.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-500">No prestart records found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}