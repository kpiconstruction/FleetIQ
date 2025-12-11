import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { Plus, Download, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import VehicleFilters from "../components/vehicles/VehicleFilters";
import VehicleTable from "../components/vehicles/VehicleTable";

export default function Vehicles() {
  const [filters, setFilters] = useState({
    search: "",
    state: "all",
    depot: "all",
    asset_type: "all",
    ownership_type: "all",
    status: "all",
    hire_provider: "all",
    overdue_service: false,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Search
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (
          !v.asset_code?.toLowerCase().includes(search) &&
          !v.rego?.toLowerCase().includes(search) &&
          !v.vin?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }

      // Filters
      if (filters.state !== "all" && v.state !== filters.state) return false;
      if (filters.asset_type !== "all" && v.asset_type !== filters.asset_type) return false;
      if (filters.ownership_type !== "all" && v.ownership_type !== filters.ownership_type) return false;
      if (filters.status !== "all" && v.status !== filters.status) return false;
      if (filters.hire_provider !== "all" && v.hire_provider_id !== filters.hire_provider) return false;
      
      // Overdue service filter
      if (filters.overdue_service) {
        if (!v.next_service_due_date || new Date(v.next_service_due_date) >= new Date()) {
          return false;
        }
      }

      return true;
    });
  }, [vehicles, filters]);

  const exportToCSV = () => {
    const headers = ["Asset Code", "Rego", "Type", "State", "Depot", "Ownership", "Status", "Last Service", "Next Service"];
    const rows = filteredVehicles.map(v => [
      v.asset_code,
      v.rego || "",
      v.asset_type,
      v.state,
      v.primary_depot || "",
      v.ownership_type,
      v.status,
      v.last_service_date || "",
      v.next_service_due_date || ""
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vehicles-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Vehicles</h1>
          <p className="text-slate-500 mt-1">
            {filteredVehicles.length} of {vehicles.length} vehicles
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Link to={createPageUrl("VehicleForm")}>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <VehicleFilters
          filters={filters}
          setFilters={setFilters}
          hireProviders={hireProviders}
        />
      </div>

      {/* Table */}
      {vehiclesLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <VehicleTable vehicles={filteredVehicles} hireProviders={hireProviders} />
      )}
    </div>
  );
}