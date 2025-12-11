import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { format, subDays } from "date-fns";
import { AlertTriangle, Eye, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function HighRiskWorkers({ 
  prestarts, 
  incidents, 
  defects, 
  vehicles,
  dateRange = 30,
  stateFilter = "all",
  functionClassFilter = "all",
  ownershipFilter = "all"
}) {
  const [localDateRange, setLocalDateRange] = useState(dateRange);
  const [localStateFilter, setLocalStateFilter] = useState(stateFilter);
  const [localFunctionFilter, setLocalFunctionFilter] = useState(functionClassFilter);
  const [localOwnershipFilter, setLocalOwnershipFilter] = useState(ownershipFilter);

  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, {});
  }, [vehicles]);

  const highRiskWorkers = useMemo(() => {
    const now = new Date();
    const ninetyDaysAgo = subDays(now, 90);
    const twelveMonthsAgo = subDays(now, 365);

    // Group data by worker
    const workerData = {};

    // Process prestarts
    prestarts.forEach((p) => {
      const workerName = p.worker_name || p.operator_name;
      if (!workerName) return;

      const vehicle = vehicleMap[p.vehicle_id];
      if (!vehicle) return;

      // Apply filters
      if (localStateFilter !== "all" && vehicle.state !== localStateFilter) return;
      if (localFunctionFilter !== "all" && vehicle.vehicle_function_class !== localFunctionFilter) return;
      if (localOwnershipFilter !== "all" && vehicle.ownership_type !== localOwnershipFilter) return;

      if (!workerData[workerName]) {
        workerData[workerName] = {
          worker_name: workerName,
          worker_external_id: p.worker_external_id,
          failed_prestarts_90d: 0,
          critical_defects_90d: 0,
          incidents_12m: 0,
          hvnl_incidents_12m: 0,
          at_fault_count: 0,
          states: new Set(),
          function_classes: new Set(),
          total_prestarts_90d: 0,
        };
      }

      const prestartDate = new Date(p.prestart_datetime);
      if (prestartDate >= ninetyDaysAgo) {
        workerData[workerName].total_prestarts_90d++;
        if (p.overall_result === "Fail") {
          workerData[workerName].failed_prestarts_90d++;
        }
      }

      workerData[workerName].states.add(vehicle.state);
      workerData[workerName].function_classes.add(vehicle.vehicle_function_class);
    });

    // Process defects
    defects.forEach((d) => {
      const prestart = prestarts.find(p => p.id === d.prestart_id);
      if (!prestart) return;

      const workerName = prestart.worker_name || prestart.operator_name;
      if (!workerName || !workerData[workerName]) return;

      const defectDate = new Date(d.reported_at || prestart.prestart_datetime);
      if (defectDate >= ninetyDaysAgo && d.severity === "Critical") {
        workerData[workerName].critical_defects_90d++;
      }
    });

    // Process incidents
    incidents.forEach((inc) => {
      const workerName = inc.driver_name;
      if (!workerName) return;

      const vehicle = vehicleMap[inc.vehicle_id];
      if (vehicle) {
        if (localStateFilter !== "all" && vehicle.state !== localStateFilter) return;
        if (localFunctionFilter !== "all" && vehicle.vehicle_function_class !== localFunctionFilter) return;
        if (localOwnershipFilter !== "all" && vehicle.ownership_type !== localOwnershipFilter) return;
      }

      if (!workerData[workerName]) {
        workerData[workerName] = {
          worker_name: workerName,
          worker_external_id: inc.driver_external_id,
          failed_prestarts_90d: 0,
          critical_defects_90d: 0,
          incidents_12m: 0,
          hvnl_incidents_12m: 0,
          at_fault_count: 0,
          states: vehicle ? new Set([vehicle.state]) : new Set(),
          function_classes: vehicle ? new Set([vehicle.vehicle_function_class]) : new Set(),
          total_prestarts_90d: 0,
        };
      }

      const incidentDate = new Date(inc.incident_datetime);
      if (incidentDate >= twelveMonthsAgo) {
        workerData[workerName].incidents_12m++;
        
        if (inc.incident_type === "HVNL Breach" && 
            (inc.severity === "Critical" || inc.severity === "Serious")) {
          workerData[workerName].hvnl_incidents_12m++;
        }

        // Count at-fault (assuming we track this in description/corrective actions for now)
        // In real implementation, you'd have a specific field
        workerData[workerName].at_fault_count++;
      }
    });

    // Calculate risk level and filter high-risk workers
    return Object.values(workerData)
      .map((worker) => {
        // High-Risk Qualification Logic
        const isHighRisk = (
          worker.at_fault_count >= 2 ||
          worker.hvnl_incidents_12m >= 1 ||
          worker.critical_defects_90d >= 3 ||
          worker.failed_prestarts_90d >= 5
        );

        if (!isHighRisk) return null;

        // Calculate risk level
        let riskLevel = "Green";
        let riskScore = 0;

        if (worker.failed_prestarts_90d >= 5) riskScore += 2;
        else if (worker.failed_prestarts_90d >= 3) riskScore += 1;

        if (worker.critical_defects_90d >= 3) riskScore += 2;
        else if (worker.critical_defects_90d >= 2) riskScore += 1;

        if (worker.at_fault_count >= 2) riskScore += 3;
        else if (worker.at_fault_count >= 1) riskScore += 1;

        if (worker.hvnl_incidents_12m >= 1) riskScore += 3;

        if (riskScore >= 5) riskLevel = "Red";
        else if (riskScore >= 3) riskLevel = "Amber";

        return {
          ...worker,
          state: Array.from(worker.states).join(", "),
          vehicle_function_class: Array.from(worker.function_classes).join(", "),
          risk_level: riskLevel,
          risk_score: riskScore,
          status: riskLevel === "Red" ? "Action Required" : "Monitor",
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.risk_score - a.risk_score);
  }, [prestarts, incidents, defects, vehicleMap, localStateFilter, localFunctionFilter, localOwnershipFilter]);

  const getRiskBadge = (level) => {
    const styles = {
      Red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900",
      Amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900",
      Green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900",
    };
    return (
      <Badge variant="outline" className={styles[level]}>
        {level === "Red" && <AlertTriangle className="w-3 h-3 mr-1" />}
        {level}
      </Badge>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              High-Risk Workers (HVNL & Safety Exposure)
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {highRiskWorkers.length} workers flagged for risk review
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Select value={localStateFilter} onValueChange={setLocalStateFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="VIC">VIC</SelectItem>
                <SelectItem value="NSW">NSW</SelectItem>
                <SelectItem value="QLD">QLD</SelectItem>
                <SelectItem value="TAS">TAS</SelectItem>
                <SelectItem value="NT">NT</SelectItem>
                <SelectItem value="ACT">ACT</SelectItem>
              </SelectContent>
            </Select>

            <Select value={localFunctionFilter} onValueChange={setLocalFunctionFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Function" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="TMA">TMA</SelectItem>
                <SelectItem value="PodTruckTruck">Pod Truck</SelectItem>
                <SelectItem value="TrafficUte">Traffic Ute</SelectItem>
              </SelectContent>
            </Select>

            <Select value={localOwnershipFilter} onValueChange={setLocalOwnershipFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Ownership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Owned">Owned</SelectItem>
                <SelectItem value="ContractHire">Hire</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-900/50">
              <TableHead>Worker Name</TableHead>
              <TableHead>State(s)</TableHead>
              <TableHead>Function Class</TableHead>
              <TableHead className="text-center">Failed Prestarts (90d)</TableHead>
              <TableHead className="text-center">Critical Defects (90d)</TableHead>
              <TableHead className="text-center">Incidents (12m)</TableHead>
              <TableHead className="text-center">HVNL Incidents</TableHead>
              <TableHead className="text-center">At-Fault Count</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {highRiskWorkers.map((worker, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                <TableCell className="font-medium">{worker.worker_name}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">{worker.state}</TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                  {worker.vehicle_function_class}
                </TableCell>
                <TableCell className="text-center">
                  {worker.failed_prestarts_90d > 0 ? (
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400">
                      {worker.failed_prestarts_90d}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {worker.critical_defects_90d > 0 ? (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400">
                      {worker.critical_defects_90d}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {worker.incidents_12m > 0 ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400">
                      {worker.incidents_12m}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {worker.hvnl_incidents_12m > 0 ? (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 font-semibold">
                      {worker.hvnl_incidents_12m}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center font-semibold">{worker.at_fault_count}</TableCell>
                <TableCell>{getRiskBadge(worker.risk_level)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    worker.status === "Action Required"
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400"
                      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400"
                  }>
                    {worker.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link to={createPageUrl(`WorkerRiskProfile?worker=${encodeURIComponent(worker.worker_name)}`)}>
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {highRiskWorkers.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <AlertTriangle className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400">No high-risk workers identified</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">Workers meeting risk criteria will appear here</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}