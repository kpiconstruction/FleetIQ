import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import { Search, Filter, Download, Fuel as FuelIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function Fuel() {
  const [filters, setFilters] = useState({
    search: "",
    state: "all",
    fuel_type: "all",
  });

  const { data: fuelTransactions = [], isLoading } = useQuery({
    queryKey: ["fuelTransactions"],
    queryFn: () => base44.entities.FuelTransaction.list("-transaction_datetime", 500),
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

  const filteredTransactions = useMemo(() => {
    return fuelTransactions.filter((f) => {
      const vehicle = vehicleMap[f.vehicle_id];

      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !vehicle?.asset_code?.toLowerCase().includes(search) &&
          !vehicle?.rego?.toLowerCase().includes(search) &&
          !f.site_location?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      if (filters.state !== "all" && vehicle?.state !== filters.state) return false;
      if (filters.fuel_type !== "all" && f.fuel_type !== filters.fuel_type) return false;

      return true;
    });
  }, [fuelTransactions, filters, vehicleMap]);

  const totalCost = filteredTransactions.reduce((sum, f) => sum + (f.total_cost || 0), 0);
  const totalLitres = filteredTransactions.reduce((sum, f) => sum + (f.litres || 0), 0);
  const avgUnitPrice = totalLitres > 0 ? totalCost / totalLitres : 0;

  const exportToCSV = () => {
    const headers = ["Date/Time", "Asset Code", "Litres", "Unit Price", "Total Cost", "Location", "Fuel Type", "Odometer"];
    const rows = filteredTransactions.map((f) => {
      const vehicle = vehicleMap[f.vehicle_id];
      return [
        format(new Date(f.transaction_datetime), "yyyy-MM-dd HH:mm"),
        vehicle?.asset_code || "",
        f.litres || 0,
        f.unit_price || 0,
        f.total_cost || 0,
        f.site_location || "",
        f.fuel_type || "",
        f.odometer_at_fill || "",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuel-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Fuel Transactions</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{filteredTransactions.length} transactions</p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Spend</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Litres</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalLitres.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}L</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Avg Price/Litre</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${avgUnitPrice.toFixed(3)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by asset, location..."
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
            <Select value={filters.fuel_type} onValueChange={(v) => setFilters({ ...filters, fuel_type: v })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Fuel Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Diesel">Diesel</SelectItem>
                <SelectItem value="Unleaded 91">Unleaded 91</SelectItem>
                <SelectItem value="Unleaded 95">Unleaded 95</SelectItem>
                <SelectItem value="Unleaded 98">Unleaded 98</SelectItem>
                <SelectItem value="Premium Diesel">Premium Diesel</SelectItem>
                <SelectItem value="AdBlue">AdBlue</SelectItem>
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
                <TableHead>Date/Time</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Litres</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Fuel Type</TableHead>
                <TableHead>Odometer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((f) => {
                const vehicle = vehicleMap[f.vehicle_id];
                return (
                  <TableRow key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                    <TableCell className="font-medium">
                      {format(new Date(f.transaction_datetime), "d MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={createPageUrl(`VehicleDetail?id=${f.vehicle_id}`)}
                        className="text-indigo-600 hover:underline"
                      >
                        {vehicle?.asset_code || "-"}
                      </Link>
                    </TableCell>
                    <TableCell>{f.litres?.toFixed(1)}L</TableCell>
                    <TableCell>${f.unit_price?.toFixed(3)}</TableCell>
                    <TableCell className="font-medium">${f.total_cost?.toFixed(2)}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{f.site_location || "-"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {f.fuel_type || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{f.odometer_at_fill?.toLocaleString() || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center">
              <FuelIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No fuel transactions found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}