import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import {
  ArrowLeft,
  AlertTriangle,
  Truck,
  User,
  Calendar,
  MapPin,
  FileText,
  Wrench,
  Plus,
  Lock,
} from "lucide-react";
import { usePermissions } from "../components/auth/usePermissions";
import WorkOrderForm from "../components/maintenance/WorkOrderForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function IncidentDetail() {
  const { can } = usePermissions();
  const urlParams = new URLSearchParams(window.location.search);
  const incidentId = urlParams.get("id");

  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", incidentId],
    queryFn: () => base44.entities.IncidentRecord.filter({ id: incidentId }),
    enabled: !!incidentId,
    select: (data) => data[0],
  });

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", incident?.vehicle_id],
    queryFn: () => base44.entities.Vehicle.filter({ id: incident.vehicle_id }),
    enabled: !!incident?.vehicle_id,
    select: (data) => data[0],
  });

  const { data: linkedWorkOrders = [] } = useQuery({
    queryKey: ["workOrders", "incident", incidentId],
    queryFn: () => base44.entities.MaintenanceWorkOrder.filter({ linked_incident_id: incidentId }),
    enabled: !!incidentId,
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.MaintenanceWorkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders", "incident", incidentId] });
      setShowWorkOrderForm(false);
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-6 lg:p-8">
        <p>Incident not found</p>
      </div>
    );
  }

  const getSeverityBadge = (severity) => {
    const styles = {
      Critical: "bg-rose-50 text-rose-700 border-rose-200",
      Serious: "bg-orange-50 text-orange-700 border-orange-200",
      Moderate: "bg-amber-50 text-amber-700 border-amber-200",
      Minor: "bg-blue-50 text-blue-700 border-blue-200",
    };
    return (
      <Badge variant="outline" className={`text-sm ${styles[severity]}`}>
        {severity}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    const styles = {
      Open: "bg-rose-50 text-rose-700 border-rose-200",
      "Under Investigation": "bg-amber-50 text-amber-700 border-amber-200",
      Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Closed: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return (
      <Badge variant="outline" className={`text-sm ${styles[status]}`}>
        {status}
      </Badge>
    );
  };

  const getPriorityFromSeverity = (severity) => {
    if (severity === "Critical" || severity === "Serious") return "SafetyCritical";
    if (severity === "Moderate") return "Major";
    return "Routine";
  };

  const handleCreateWorkOrder = (woData) => {
    createWorkOrderMutation.mutate(woData);
  };

  const canCreateWorkOrder = incident.vehicle_id && can.createWorkOrder;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Incident #{incident.id.slice(0, 8)}
            </h1>
            {getSeverityBadge(incident.severity)}
            {getStatusBadge(incident.status)}
          </div>
          <p className="text-slate-500 dark:text-slate-400">{incident.incident_type}</p>
        </div>
        {canCreateWorkOrder && (
          <Button
            onClick={() => setShowWorkOrderForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Work Order
          </Button>
        )}
      </div>

      {/* Overview Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Incident Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Date/Time */}
            <div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Incident Date/Time</span>
              </div>
              <p className="text-lg font-semibold">
                {format(new Date(incident.incident_datetime), "d MMM yyyy HH:mm")}
              </p>
            </div>

            {/* Vehicle */}
            <div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Truck className="w-4 h-4" />
                <span className="text-sm font-medium">Vehicle</span>
              </div>
              {vehicle ? (
                <Link to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}>
                  <p className="text-lg font-semibold text-indigo-600 hover:text-indigo-700">
                    {vehicle.asset_code} ({vehicle.rego})
                  </p>
                </Link>
              ) : (
                <p className="text-lg font-semibold text-slate-500">Not specified</p>
              )}
            </div>

            {/* Driver */}
            <div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Driver</span>
              </div>
              <p className="text-lg font-semibold">{incident.driver_name || "—"}</p>
            </div>

            {/* Location */}
            <div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">Location</span>
              </div>
              <p className="text-lg font-semibold">{incident.location || "—"}</p>
            </div>

            {/* Project/Client */}
            <div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Project / Client</span>
              </div>
              <p className="text-lg font-semibold">
                {incident.project_code || incident.client_name || "—"}
              </p>
            </div>

            {/* Damage Cost */}
            {incident.damage_cost && (
              <div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                  <span className="text-sm font-medium">Damage Cost</span>
                </div>
                <p className="text-lg font-semibold">${incident.damage_cost.toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {incident.description && (
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Description</h3>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {incident.description}
              </p>
            </div>
          )}

          {/* HVNL Breach */}
          {incident.hvnl_breach_type && (
            <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-4 border border-rose-200 dark:border-rose-900">
              <h3 className="font-semibold text-rose-900 dark:text-rose-200 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                HVNL Breach
              </h3>
              <p className="text-rose-700 dark:text-rose-300">{incident.hvnl_breach_type}</p>
            </div>
          )}

          {/* Investigation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-slate-600 dark:text-slate-400">Investigation Status</Label>
              <p className="font-semibold">{incident.investigation_status}</p>
            </div>
            <div>
              <Label className="text-sm text-slate-600 dark:text-slate-400">Reported By</Label>
              <p className="font-semibold">{incident.reported_by || "—"}</p>
            </div>
          </div>

          {/* Corrective Actions */}
          {incident.corrective_actions && (
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Corrective Actions
              </h3>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {incident.corrective_actions}
              </p>
            </div>
          )}

          {/* Attachments */}
          {incident.attachments && incident.attachments.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Attachments</h3>
              <div className="flex flex-wrap gap-2">
                {incident.attachments.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:text-indigo-700 underline"
                  >
                    Attachment {idx + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Work Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Linked Work Orders
          </CardTitle>
          <CardDescription>
            {linkedWorkOrders.length} work order(s) raised from this incident
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedWorkOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WO ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Raised</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedWorkOrders.map((wo) => (
                    <TableRow key={wo.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <TableCell>
                        <Link
                          to={createPageUrl(`VehicleDetail?id=${wo.vehicle_id}`)}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          #{wo.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50">
                          {wo.work_order_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            wo.priority === "SafetyCritical"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : wo.priority === "Major"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {wo.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            wo.status === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : wo.status === "InProgress"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {wo.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(wo.raised_datetime), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        {wo.due_date ? format(new Date(wo.due_date), "d MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>{wo.assigned_to_workshop_name || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Wrench className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No work orders raised from this incident</p>
              {canCreateWorkOrder && (
                <Button
                  variant="outline"
                  onClick={() => setShowWorkOrderForm(true)}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Work Order
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Order Form Dialog */}
      <WorkOrderForm
        open={showWorkOrderForm}
        onOpenChange={setShowWorkOrderForm}
        vehicleId={incident.vehicle_id}
        vehicle={vehicle}
        prefillData={{
          work_order_type: "Corrective",
          raised_from: "Incident",
          linked_incident_id: incident.id,
          priority: getPriorityFromSeverity(incident.severity),
          notes_internal: `[AUTO-LINK] Incident #${incident.id.slice(0, 8)}: ${incident.incident_type} – ${
            incident.description?.slice(0, 150) || "No description"
          }${incident.description?.length > 150 ? "..." : ""}`,
        }}
        onSubmit={handleCreateWorkOrder}
        isSubmitting={createWorkOrderMutation.isPending}
      />
    </div>
  );
}