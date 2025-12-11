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
  ClipboardCheck,
  Wrench,
  Plus,
  Edit,
  Lock,
} from "lucide-react";
import { usePermissions } from "../components/auth/usePermissions";
import WorkOrderForm from "../components/maintenance/WorkOrderForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function PrestartDefectDetail() {
  const { can } = usePermissions();
  const urlParams = new URLSearchParams(window.location.search);
  const defectId = urlParams.get("id");

  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editData, setEditData] = useState({});
  const queryClient = useQueryClient();

  const { data: defect, isLoading } = useQuery({
    queryKey: ["defect", defectId],
    queryFn: () => base44.entities.PrestartDefect.filter({ id: defectId }),
    enabled: !!defectId,
    select: (data) => data[0],
  });

  const { data: prestart } = useQuery({
    queryKey: ["prestart", defect?.prestart_id],
    queryFn: () => base44.entities.PrestartCheck.filter({ id: defect.prestart_id }),
    enabled: !!defect?.prestart_id,
    select: (data) => data[0],
  });

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", defect?.vehicle_id],
    queryFn: () => base44.entities.Vehicle.filter({ id: defect.vehicle_id }),
    enabled: !!defect?.vehicle_id,
    select: (data) => data[0],
  });

  const { data: linkedWorkOrders = [] } = useQuery({
    queryKey: ["workOrders", "defect", defectId],
    queryFn: () => base44.entities.MaintenanceWorkOrder.filter({ linked_prestart_defect_id: defectId }),
    enabled: !!defectId,
  });

  const { data: serviceRecord } = useQuery({
    queryKey: ["serviceRecord", defect?.linked_service_id],
    queryFn: () => base44.entities.ServiceRecord.filter({ id: defect.linked_service_id }),
    enabled: !!defect?.linked_service_id,
    select: (data) => data[0],
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: (data) => base44.entities.MaintenanceWorkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders", "defect", defectId] });
      setShowWorkOrderForm(false);
    },
  });

  const updateDefectMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PrestartDefect.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defect", defectId] });
      setEditDialog(false);
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

  if (!defect) {
    return (
      <div className="p-6 lg:p-8">
        <p>Defect not found</p>
      </div>
    );
  }

  const getSeverityBadge = (severity) => {
    const styles = {
      Critical: "bg-rose-50 text-rose-700 border-rose-200",
      High: "bg-orange-50 text-orange-700 border-orange-200",
      Medium: "bg-amber-50 text-amber-700 border-amber-200",
      Low: "bg-blue-50 text-blue-700 border-blue-200",
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
      "In Repair": "bg-amber-50 text-amber-700 border-amber-200",
      Closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Deferred: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return (
      <Badge variant="outline" className={`text-sm ${styles[status]}`}>
        {status}
      </Badge>
    );
  };

  const getPriorityFromSeverity = (severity) => {
    if (severity === "Critical") return "SafetyCritical";
    if (severity === "High") return "Major";
    return "Routine";
  };

  const handleCreateWorkOrder = (woData) => {
    createWorkOrderMutation.mutate(woData);
  };

  const handleOpenEditDialog = () => {
    setEditData({
      status: defect.status,
      rectification_notes: defect.rectification_notes || "",
    });
    setEditDialog(true);
  };

  const handleSaveEdit = () => {
    const updateData = { ...editData };
    if (editData.status === "Closed" && !defect.closed_at) {
      updateData.closed_at = new Date().toISOString();
    }
    updateDefectMutation.mutate({ id: defect.id, data: updateData });
  };

  const canCreateWorkOrder = defect.vehicle_id && can.createWorkOrder;
  const canEdit = can.editPrestartDefect;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl("Prestarts")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Defect #{defect.id.slice(0, 8)}
            </h1>
            {getSeverityBadge(defect.severity)}
            {getStatusBadge(defect.status)}
          </div>
          <p className="text-slate-500 dark:text-slate-400">Prestart Defect</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={handleOpenEditDialog}>
              <Edit className="w-4 h-4 mr-2" />
              Update Status
            </Button>
          )}
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
      </div>

      {/* Defect Details Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Defect Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <p className="text-sm text-slate-500">{vehicle.state}</p>
                </Link>
              ) : (
                <p className="text-lg font-semibold text-slate-500">Not specified</p>
              )}
            </div>

            {/* Reported Date */}
            <div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Reported</span>
              </div>
              <p className="text-lg font-semibold">
                {format(new Date(defect.reported_at), "d MMM yyyy HH:mm")}
              </p>
            </div>

            {/* Closed Date */}
            {defect.closed_at && (
              <div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Closed</span>
                </div>
                <p className="text-lg font-semibold">
                  {format(new Date(defect.closed_at), "d MMM yyyy HH:mm")}
                </p>
              </div>
            )}
          </div>

          {/* Prestart Context */}
          {prestart && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Prestart Context</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Date/Time</p>
                  <p className="font-medium">
                    {format(new Date(prestart.prestart_datetime), "d MMM yyyy HH:mm")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Worker</p>
                  <p className="font-medium">{prestart.worker_name || prestart.operator_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Client</p>
                  <p className="font-medium">{prestart.client_name || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Overall Result</p>
                  <Badge
                    variant="outline"
                    className={
                      prestart.overall_result === "Pass"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }
                  >
                    {prestart.overall_result}
                  </Badge>
                </div>
              </div>
              <Link to={createPageUrl(`PrestartDetail?id=${prestart.id}`)}>
                <Button variant="link" className="p-0 h-auto mt-2 text-indigo-600">
                  View Full Prestart →
                </Button>
              </Link>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Defect Description</h3>
            <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {defect.defect_description}
            </p>
          </div>

          {/* Rectification Notes */}
          {defect.rectification_notes && (
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Rectification Notes
              </h3>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {defect.rectification_notes}
              </p>
            </div>
          )}

          {/* Linked Service */}
          {serviceRecord && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-900">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-2">
                Linked Service Record
              </h3>
              <p className="text-emerald-700 dark:text-emerald-300">
                Service on {format(new Date(serviceRecord.service_date), "d MMM yyyy")} at{" "}
                {serviceRecord.workshop_name || "workshop"}
              </p>
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
            {linkedWorkOrders.length} work order(s) raised from this defect
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
                    <TableHead>Completed</TableHead>
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
                      <TableCell>
                        {wo.completion_confirmed_at
                          ? format(new Date(wo.completion_confirmed_at), "d MMM yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Wrench className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No work orders raised from this defect yet</p>
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
        vehicleId={defect.vehicle_id}
        vehicle={vehicle}
        prefillData={{
          work_order_type: "DefectRepair",
          raised_from: "PrestartDefect",
          linked_prestart_defect_id: defect.id,
          priority: getPriorityFromSeverity(defect.severity),
          notes_internal: `[AUTO-LINK] Defect #${defect.id.slice(0, 8)}: ${defect.severity} - ${
            defect.defect_description?.slice(0, 150) || "No description"
          }${defect.defect_description?.length > 150 ? "..." : ""}`,
        }}
        onSubmit={handleCreateWorkOrder}
        isSubmitting={createWorkOrderMutation.isPending}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Defect Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select
                value={editData.status}
                onValueChange={(v) => setEditData({ ...editData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Repair">In Repair</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Deferred">Deferred</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rectification Notes</Label>
              <Textarea
                value={editData.rectification_notes}
                onChange={(e) => setEditData({ ...editData, rectification_notes: e.target.value })}
                rows={4}
                placeholder="Details of repairs or actions taken..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateDefectMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updateDefectMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}