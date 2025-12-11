import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, ChevronRight } from "lucide-react";

export default function VehicleTable({ vehicles, hireProviders }) {
  const getProviderName = (id) => {
    const provider = hireProviders?.find((p) => p.id === id);
    return provider?.name || "-";
  };

  const getStatusBadge = (status) => {
    const styles = {
      Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
      "In Maintenance": "bg-amber-50 text-amber-700 border-amber-200",
      Decommissioned: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.Active}>
        {status}
      </Badge>
    );
  };

  const getOwnershipBadge = (type) => {
    const styles = {
      Owned: "bg-indigo-50 text-indigo-700 border-indigo-200",
      ContractHire: "bg-violet-50 text-violet-700 border-violet-200",
      DayHire: "bg-sky-50 text-sky-700 border-sky-200",
    };
    const labels = {
      Owned: "Owned",
      ContractHire: "Contract",
      DayHire: "Day Hire",
    };
    return (
      <Badge variant="outline" className={styles[type] || styles.Owned}>
        {labels[type] || type}
      </Badge>
    );
  };

  const getPrestartIcon = (result) => {
    if (result === "Pass") return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (result === "Fail") return <XCircle className="w-4 h-4 text-rose-500" />;
    return <span className="text-slate-400">-</span>;
  };

  const isOverdue = (vehicle) => {
    if (!vehicle.next_service_due_date) return false;
    return new Date(vehicle.next_service_due_date) < new Date();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Asset Code</TableHead>
            <TableHead className="font-semibold">Rego</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">State</TableHead>
            <TableHead className="font-semibold">Ownership</TableHead>
            <TableHead className="font-semibold">Hire Provider</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Prestart</TableHead>
            <TableHead className="font-semibold">Last Service</TableHead>
            <TableHead className="font-semibold">Next Service</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((vehicle) => (
            <TableRow
              key={vehicle.id}
              className="cursor-pointer hover:bg-slate-50 transition-colors group"
            >
              <TableCell className="font-medium">{vehicle.asset_code}</TableCell>
              <TableCell className="text-slate-600">{vehicle.rego || "-"}</TableCell>
              <TableCell>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  {vehicle.asset_type}
                </span>
              </TableCell>
              <TableCell className="font-medium">{vehicle.state}</TableCell>
              <TableCell>{getOwnershipBadge(vehicle.ownership_type)}</TableCell>
              <TableCell className="text-slate-600">
                {vehicle.ownership_type !== "Owned" ? getProviderName(vehicle.hire_provider_id) : "-"}
              </TableCell>
              <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
              <TableCell className="text-center">{getPrestartIcon(vehicle.last_prestart_result)}</TableCell>
              <TableCell className="text-slate-600">
                {vehicle.last_service_date ? format(new Date(vehicle.last_service_date), "d MMM yyyy") : "-"}
              </TableCell>
              <TableCell>
                {vehicle.next_service_due_date ? (
                  <span className={`flex items-center gap-1 ${isOverdue(vehicle) ? "text-rose-600 font-medium" : "text-slate-600"}`}>
                    {isOverdue(vehicle) && <AlertTriangle className="w-4 h-4" />}
                    {format(new Date(vehicle.next_service_due_date), "d MMM yyyy")}
                  </span>
                ) : "-"}
              </TableCell>
              <TableCell>
                <Link
                  to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {vehicles.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-slate-500">No vehicles found matching your filters</p>
        </div>
      )}
    </div>
  );
}