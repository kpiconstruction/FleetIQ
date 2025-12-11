import React from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function VehicleFilters({ filters, setFilters, hireProviders }) {
  const hasActiveFilters = Object.values(filters).some(
    (v) => v && v !== "all" && v !== "" && v !== false
  );

  const clearFilters = () => {
    setFilters({
      search: "",
      state: "all",
      depot: "all",
      asset_type: "all",
      vehicle_function_class: "all",
      ownership_type: "all",
      status: "all",
      hire_provider: "all",
      assignar_tracked: "all",
      overdue_service: false,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by asset code, rego..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />

          <Select
            value={filters.state}
            onValueChange={(v) => setFilters({ ...filters, state: v })}
          >
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

          <Select
            value={filters.asset_type}
            onValueChange={(v) => setFilters({ ...filters, asset_type: v })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Asset Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="TMA">TMA</SelectItem>
              <SelectItem value="Pod Truck">Pod Truck</SelectItem>
              <SelectItem value="Traffic Ute">Traffic Ute</SelectItem>
              <SelectItem value="Plant">Plant</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.vehicle_function_class}
            onValueChange={(v) => setFilters({ ...filters, vehicle_function_class: v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Func Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              <SelectItem value="CorporateCar">Corporate Car</SelectItem>
              <SelectItem value="TrafficUte">Traffic Ute</SelectItem>
              <SelectItem value="VMSUte">VMS Ute</SelectItem>
              <SelectItem value="PodTruckCar">Pod Truck Car</SelectItem>
              <SelectItem value="PodTruckTruck">Pod Truck Truck</SelectItem>
              <SelectItem value="TMA">TMA</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.ownership_type}
            onValueChange={(v) => setFilters({ ...filters, ownership_type: v })}
          >
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

          <Select
            value={filters.status}
            onValueChange={(v) => setFilters({ ...filters, status: v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="In Maintenance">In Maintenance</SelectItem>
              <SelectItem value="Decommissioned">Decommissioned</SelectItem>
            </SelectContent>
          </Select>

          {hireProviders && hireProviders.length > 0 && (
            <Select
              value={filters.hire_provider}
              onValueChange={(v) => setFilters({ ...filters, hire_provider: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Hire Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {hireProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={filters.assignar_tracked}
            onValueChange={(v) => setFilters({ ...filters, assignar_tracked: v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Assignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              <SelectItem value="true">Assignar Tracked</SelectItem>
              <SelectItem value="false">Not Tracked</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={filters.overdue_service ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setFilters({ ...filters, overdue_service: !filters.overdue_service })
            }
            className={filters.overdue_service ? "bg-rose-600 hover:bg-rose-700" : ""}
          >
            Overdue Service
          </Button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Active filters:</span>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}