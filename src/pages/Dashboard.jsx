import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, subDays } from "date-fns";
import {
  Truck,
  Building2,
  ClipboardCheck,
  Wrench,
  Fuel,
  Clock,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import KPICard from "../components/dashboard/KPICard";
import StateFilter from "../components/dashboard/StateFilter";
import FleetUtilisationChart from "../components/dashboard/FleetUtilisationChart";
import DowntimeByCauseChart from "../components/dashboard/DowntimeByCauseChart";
import ProblemAssetsTable from "../components/dashboard/ProblemAssetsTable";
import StandDownSummary from "../components/dashboard/StandDownSummary";
import FleetByFunctionChart from "../components/dashboard/FleetByFunctionChart";
import HighRiskWorkers from "../components/dashboard/HighRiskWorkers";

export default function Dashboard() {
  const [stateFilter, setStateFilter] = useState("All");
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [functionClassFilter, setFunctionClassFilter] = useState("all");

  const { data: vehicles = [], isLoading: vehiclesLoading, refetch: refetchVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: prestarts = [], isLoading: prestartsLoading } = useQuery({
    queryKey: ["prestarts"],
    queryFn: () => base44.entities.PrestartCheck.list("-prestart_datetime", 500),
  });

  const { data: fuelTransactions = [], isLoading: fuelLoading } = useQuery({
    queryKey: ["fuelTransactions"],
    queryFn: () => base44.entities.FuelTransaction.list("-transaction_datetime", 500),
  });

  const { data: downtimeEvents = [], isLoading: downtimeLoading } = useQuery({
    queryKey: ["downtimeEvents"],
    queryFn: () => base44.entities.AssetDowntimeEvent.list("-start_datetime", 500),
  });

  const { data: usageRecords = [] } = useQuery({
    queryKey: ["usageRecords"],
    queryFn: () => base44.entities.UsageRecord.list("-usage_date", 500),
  });

  const { data: serviceRecords = [] } = useQuery({
    queryKey: ["serviceRecords"],
    queryFn: () => base44.entities.ServiceRecord.list("-service_date", 200),
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => base44.entities.IncidentRecord.list("-incident_datetime", 500),
  });

  const { data: defects = [] } = useQuery({
    queryKey: ["defects"],
    queryFn: () => base44.entities.PrestartDefect.list("-reported_at", 500),
  });

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (stateFilter !== "All" && v.state !== stateFilter) return false;
      if (assetTypeFilter !== "all" && v.asset_type !== assetTypeFilter) return false;
      if (ownershipFilter !== "all" && v.ownership_type !== ownershipFilter) return false;
      if (functionClassFilter !== "all" && v.vehicle_function_class !== functionClassFilter) return false;
      return true;
    });
  }, [vehicles, stateFilter, assetTypeFilter, ownershipFilter, functionClassFilter]);

  const vehicleIds = useMemo(() => new Set(filteredVehicles.map(v => v.id)), [filteredVehicles]);

  // KPI Calculations
  const activeVehicles = filteredVehicles.filter((v) => v.status === "Active").length;
  const ownedCount = filteredVehicles.filter((v) => v.ownership_type === "Owned").length;
  const hireCount = filteredVehicles.filter((v) => v.ownership_type !== "Owned").length;

  const thirtyDaysAgo = subDays(new Date(), 30);
  
  // Exclude non-Assignar-tracked vehicles from prestart compliance
  const assignarTrackedVehicleIds = useMemo(() => {
    return new Set(filteredVehicles.filter(v => v.assignar_tracked !== false).map(v => v.id));
  }, [filteredVehicles]);

  const recentPrestarts = prestarts.filter((p) => {
    if (!assignarTrackedVehicleIds.has(p.vehicle_id)) return false;
    return new Date(p.prestart_datetime) >= thirtyDaysAgo;
  });
  
  const prestartCompliance = recentPrestarts.length > 0
    ? Math.round((recentPrestarts.filter((p) => p.overall_result === "Pass").length / recentPrestarts.length) * 100)
    : 100;

  const overdueService = filteredVehicles.filter((v) => {
    if (!v.next_service_due_date) return false;
    return new Date(v.next_service_due_date) < new Date();
  }).length;

  const recentFuel = fuelTransactions.filter((f) => {
    if (!vehicleIds.has(f.vehicle_id)) return false;
    return new Date(f.transaction_datetime) >= thirtyDaysAgo;
  });
  const totalFuelSpend = recentFuel.reduce((sum, f) => sum + (f.total_cost || 0), 0);

  const recentDowntime = downtimeEvents.filter((d) => {
    if (!vehicleIds.has(d.vehicle_id)) return false;
    return new Date(d.start_datetime) >= thirtyDaysAgo;
  });
  const totalDowntimeHours = recentDowntime.reduce((sum, d) => sum + (d.downtime_hours || 0), 0);

  // Chart Data
  const utilisationData = useMemo(() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = subDays(new Date(), i * 7);
      const weekEnd = subDays(new Date(), (i - 1) * 7);
      const weekUsage = usageRecords.filter((u) => {
        if (!vehicleIds.has(u.vehicle_id)) return false;
        const date = new Date(u.usage_date);
        return date >= weekStart && date < weekEnd;
      });
      weeks.push({
        week: format(weekStart, "MMM d"),
        hours: weekUsage.reduce((sum, u) => sum + (u.total_hours || 0), 0),
        km: weekUsage.reduce((sum, u) => sum + (u.km_travelled || 0), 0),
      });
    }
    return weeks;
  }, [usageRecords, vehicleIds]);

  const downtimeByCause = useMemo(() => {
    const causes = { KPI: 0, HireProvider: 0, Client: 0, Unknown: 0 };
    recentDowntime.forEach((d) => {
      causes[d.caused_by || "Unknown"] += d.downtime_hours || 0;
    });
    return Object.entries(causes)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [recentDowntime]);

  // Problem assets (vehicles with most issues)
  const problemAssets = useMemo(() => {
    const issueCount = {};
    recentDowntime.forEach((d) => {
      issueCount[d.vehicle_id] = (issueCount[d.vehicle_id] || 0) + 1;
    });
    return filteredVehicles
      .map((v) => ({ ...v, issue_count: issueCount[v.id] || 0 }))
      .filter((v) => v.issue_count > 0)
      .sort((a, b) => b.issue_count - a.issue_count)
      .slice(0, 10);
  }, [filteredVehicles, recentDowntime]);

  // Fleet by functional class breakdown
  const fleetByFunction = useMemo(() => {
    const breakdown = {};
    filteredVehicles.forEach((v) => {
      const funcClass = v.vehicle_function_class || "Unknown";
      breakdown[funcClass] = (breakdown[funcClass] || 0) + 1;
    });
    return breakdown;
  }, [filteredVehicles]);

  const isLoading = vehiclesLoading || prestartsLoading || fuelLoading || downtimeLoading;

  const handleRefresh = () => {
    refetchVehicles();
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Fleet Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">National overview of fleet operations</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="self-start lg:self-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <StateFilter selected={stateFilter} onChange={setStateFilter} />
          
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
              <SelectTrigger className="w-36">
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
            
            <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
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

            <Select value={functionClassFilter} onValueChange={setFunctionClassFilter}>
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
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <KPICard
            title="Active Vehicles"
            value={activeVehicles}
            icon={Truck}
            color="indigo"
          />
          <KPICard
            title="Owned vs Hire"
            value={`${ownedCount} / ${hireCount}`}
            subtitle={`${Math.round((ownedCount / (filteredVehicles.length || 1)) * 100)}% owned`}
            icon={Building2}
            color="violet"
          />
          <KPICard
            title="Prestart Compliance"
            value={`${prestartCompliance}%`}
            subtitle="Last 30 days"
            icon={ClipboardCheck}
            color={prestartCompliance >= 95 ? "emerald" : prestartCompliance >= 80 ? "amber" : "rose"}
          />
          <KPICard
            title="Overdue Service"
            value={overdueService}
            icon={Wrench}
            color={overdueService === 0 ? "emerald" : overdueService <= 3 ? "amber" : "rose"}
          />
          <KPICard
            title="Fuel Spend"
            value={`$${totalFuelSpend.toLocaleString()}`}
            subtitle="Last 30 days"
            icon={Fuel}
            color="sky"
          />
          <KPICard
            title="Downtime Hours"
            value={Math.round(totalDowntimeHours)}
            subtitle="Last 30 days"
            icon={Clock}
            color={totalDowntimeHours < 50 ? "emerald" : totalDowntimeHours < 100 ? "amber" : "rose"}
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <FleetUtilisationChart data={utilisationData} />
        <FleetByFunctionChart data={fleetByFunction} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <DowntimeByCauseChart data={downtimeByCause.length > 0 ? downtimeByCause : [{ name: "No Data", value: 1 }]} />
        <StandDownSummary downtimeEvents={recentDowntime} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <ProblemAssetsTable vehicles={problemAssets} />
      </div>

      {/* High-Risk Workers Section */}
      <div className="grid grid-cols-1 gap-6">
        <HighRiskWorkers
          prestarts={prestarts}
          incidents={incidents}
          defects={defects}
          vehicles={filteredVehicles}
          stateFilter={stateFilter}
          functionClassFilter={functionClassFilter}
          ownershipFilter={ownershipFilter}
        />
      </div>
    </div>
  );
}