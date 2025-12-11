import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "../components/auth/usePermissions";
import WorkOrderForm from "../components/maintenance/WorkOrderForm";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import {
  ArrowLeft,
  AlertTriangle,
  User,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function IncidentDetail() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const incidentId = urlParams.get("id");
  const [workOrderDialog, setWorkOrderDialog] = useState(false);

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

  const { data: relatedWorkOrders = [] } = useQuery({
    queryKey: ["incidentWorkOrders", incidentId],
    queryFn: async () => {
      const allWOs = await base44.entities.MaintenanceWorkOrder.list("-raised_datetime", 100);
      return allWOs.filter(wo => wo.linked_incident_id === incidentId);
    },
    enabled: !!incidentId,
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.MaintenanceWorkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidentWorkOrders"] });
      setWorkOrderDialog(false);
    },
  });

  const submitIncidentWorkOrder = (data) => {
    const enrichedData = {
      ...data,
      linked_incident_id: incidentId,
      notes_internal: `Raised from Incident: ${incident.incident_type} - ${incident.description}\n\n${data.notes_internal || ""}`,
    };
    createWorkOrderMutation.mutate(enrichedData);
  };

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

  const getSeverityColor = (severity) => {
    const colors = {
      Minor: "bg-blue-50 text-blue-700 border-blue-200",
      Moderate: "bg-amber-50 text-amber-700 border-amber-200",
      Serious: "bg-orange-50 text-orange-700 border-orange-200",
      Critical: "bg-rose-50 text-rose-700 border-rose-200",
    };
    return colors[severity] || colors.Moderate;
  };

  const getStatusColor = (status) => {
    const colors = {
      Open: "bg-amber-50 text-amber-700 border-amber-200",
      "Under Investigation": "bg-blue-50 text-blue-700 border-blue-200",
      Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Closed: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return colors[status] || colors.Open;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Incident Record</h1>
            <Badge variant="outline" className={getSeverityColor(incident.severity)}>
              <AlertTriangle className="w-3 h-3 mr-1" />
              {incident.severity}
            </Badge>
            <Badge variant="outline" className={getStatusColor(incident.status)}>
              {incident.status}
            </Badge>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            {format(new Date(incident.incident_datetime), "d MMMM yyyy, HH:mm")}
          </p>
        </div>
        {incident.vehicle_id && can.createWorkOrder && (
          <Button onClick={() => setWorkOrderDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Wrench className="w-4 h-4 mr-2" />
            Create Work Order
          </Button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-sm">Type</span>
          </div>
          <p className="font-semibold">{incident.incident_type}</p>
        </div>

        {incident.driver_name && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <User className="w-4 h-4" />
              <span className="text-sm">Driver</span>
            </div>
            <p className="font-semibold">{incident.driver_name}</p>
          </div>
        )}

        {vehicle && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-sm">Vehicle</span>
            </div>
            <Link
              to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}
              className="font-semibold text-indigo-600 hover:underline"
            >
              {vehicle.asset_code} ({vehicle.rego})
            </Link>
          </div>
        )}

        {incident.location && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Location</span>
            </div>
            <p className="font-semibold">{incident.location}</p>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Description</h3>
        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{incident.description}</p>

        {incident.damage_cost && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Estimated Damage Cost:</span>
              <span className="font-semibold">${incident.damage_cost.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Related Work Orders */}
      {relatedWorkOrders.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Related Work Orders ({relatedWorkOrders.length})
          </h3>
          <div className="space-y-2">
            {relatedWorkOrders.map((wo) => (
              <div key={wo.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {wo.work_order_type} - {wo.priority}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Raised: {format(new Date(wo.raised_datetime), "d MMM yyyy")}
                    {wo.due_date && ` • Due: ${format(new Date(wo.due_date), "d MMM yyyy")}`}
                  </p>
                  {wo.assigned_to_workshop_name && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Workshop: {wo.assigned_to_workshop_name}
                    </p>
                  )}
                </div>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investigation & Actions */}
      {(incident.corrective_actions || incident.investigation_status !== "Pending") && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Investigation & Corrective Actions</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Investigation Status</p>
              <Badge variant="outline" className={getStatusColor(incident.investigation_status)}>
                {incident.investigation_status}
              </Badge>
            </div>
            {incident.corrective_actions && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Corrective Actions</p>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{incident.corrective_actions}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Work Order Dialog */}
      {incident.vehicle_id && (
        <WorkOrderForm
          open={workOrderDialog}
          onOpenChange={setWorkOrderDialog}
          vehicleId={incident.vehicle_id}
          vehicle={vehicle}
          defaultValues={{
            work_order_type: "Corrective",
            raised_from: "Incident",
            priority: 
              incident.severity === "Critical" || incident.severity === "Serious" 
                ? "SafetyCritical" 
                : incident.severity === "Moderate" 
                ? "Major" 
                : "Routine",
            notes_for_provider: incident.description,
            linked_incident_id: incidentId,
          }}
          onSubmit={submitIncidentWorkOrder}
          isSubmitting={createWorkOrderMutation.isPending}
        />
      )}
    </div>
  );
}