import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function WorkOrderCompletionDialog({
  open,
  onOpenChange,
  workOrder,
  vehicle,
  onComplete,
  isSubmitting = false,
}) {
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(workOrder?.purchase_order_number || "");
  const [confirmedDowntimeHours, setConfirmedDowntimeHours] = useState(
    workOrder?.confirmed_downtime_hours || ""
  );
  const [completionNotes, setCompletionNotes] = useState(workOrder?.completion_notes || "");
  const [costChargeableTo, setCostChargeableTo] = useState(() => {
    // Default logic based on vehicle ownership and work order type
    if (vehicle?.ownership_type === "Owned") return "KPI";
    if ((vehicle?.ownership_type === "ContractHire" || vehicle?.ownership_type === "DayHire") && 
        workOrder?.work_order_type === "Scheduled") {
      return "HireProvider";
    }
    return workOrder?.work_order_type === "Scheduled" ? "HireProvider" : "KPI";
  });
  const [validationError, setValidationError] = useState("");

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: hireProvider } = useQuery({
    queryKey: ["hireProvider", vehicle?.hire_provider_id],
    queryFn: () => base44.entities.HireProvider.filter({ id: vehicle.hire_provider_id }),
    enabled: !!vehicle?.hire_provider_id,
    select: (data) => data[0],
  });

  if (!workOrder || !vehicle) return null;

  const ownershipType = vehicle.ownership_type;
  const isOwned = ownershipType === "Owned";
  const isHire = ownershipType === "ContractHire" || ownershipType === "DayHire";
  const userRole = user?.fleet_role;
  const canConfirmHire = ["FleetAdmin", "FleetCoordinator"].includes(userRole);

  const handleComplete = async () => {
    setValidationError("");

    // Client-side validation
    if (isOwned && !purchaseOrderNumber.trim()) {
      setValidationError("Purchase Order number is required for owned assets.");
      return;
    }

    if (isHire) {
      if (!canConfirmHire) {
        setValidationError("Only Fleet Coordinators can confirm completion for hire fleet work orders.");
        return;
      }
      if (!confirmedDowntimeHours || parseFloat(confirmedDowntimeHours) <= 0) {
        setValidationError("Confirmed downtime hours are required for hire fleet work orders.");
        return;
      }
    }

    // Backend validation
    try {
      const validation = await base44.functions.invoke("validateWorkOrderCompletion", {
        work_order_id: workOrder.id,
        status: "Completed",
        purchase_order_number: purchaseOrderNumber,
        confirmed_downtime_hours: parseFloat(confirmedDowntimeHours) || null,
        completion_notes: completionNotes,
      });

      if (!validation.data.valid) {
        setValidationError(validation.data.error);
        return;
      }

      // Build update payload
      const updateData = {
        status: "Completed",
        completion_notes: completionNotes || null,
      };

      if (isOwned) {
        updateData.purchase_order_number = purchaseOrderNumber;
      }

      if (isHire) {
        updateData.confirmed_downtime_hours = parseFloat(confirmedDowntimeHours);
        updateData.completion_confirmed_by_user_id = user.id;
        updateData.completion_confirmed_at = new Date().toISOString();
      }

      // Add cost_chargeable_to for service record creation
      updateData.cost_chargeable_to = costChargeableTo;

      onComplete(updateData);
    } catch (error) {
      setValidationError(error.response?.data?.error || error.message || "Validation failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Complete Work Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vehicle Info */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Vehicle</p>
                <p className="font-semibold">
                  {vehicle.asset_code} ({vehicle.rego})
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Ownership</p>
                <Badge variant="outline" className="mt-1">
                  {ownershipType}
                </Badge>
              </div>
            </div>
          </div>

          {validationError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Owned Fleet - PO Number */}
          {isOwned && (
            <div className="space-y-2">
              <Label>
                Purchase Order Number <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={purchaseOrderNumber}
                onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                placeholder="Enter PO number"
                className="font-mono"
              />
              <p className="text-xs text-slate-500">Required for owned fleet work orders</p>
            </div>
          )}

          {/* Hire Fleet - Confirmation Section */}
          {isHire && (
            <div className="space-y-4 p-4 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800">
              <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
                <Building2 className="w-5 h-5" />
                <h3 className="font-semibold">Hire Fleet Completion Confirmation</h3>
              </div>

              {hireProvider && (
                <div>
                  <p className="text-sm text-violet-600 dark:text-violet-400">Provider</p>
                  <p className="font-medium text-violet-900 dark:text-violet-200">{hireProvider.name}</p>
                </div>
              )}

              {!canConfirmHire && (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Only Fleet Coordinators can confirm completion for hire fleet work orders. Your role:{" "}
                    {userRole || "Unknown"}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>
                  Confirmed Out-of-Service Hours <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={confirmedDowntimeHours}
                  onChange={(e) => setConfirmedDowntimeHours(e.target.value)}
                  placeholder="0.0"
                  disabled={!canConfirmHire}
                />
                <p className="text-xs text-violet-600 dark:text-violet-400">
                  Total hours the asset was unavailable for this work
                </p>
              </div>
            </div>
          )}

          {/* Cost Chargeable To */}
          <div className="space-y-2">
            <Label>Cost Chargeable To</Label>
            <Select
              value={costChargeableTo}
              onValueChange={setCostChargeableTo}
              disabled={isOwned || (isHire && workOrder.work_order_type === "Scheduled")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KPI">KPI</SelectItem>
                <SelectItem value="HireProvider">Hire Provider</SelectItem>
                <SelectItem value="Client">Client</SelectItem>
                <SelectItem value="Shared">Shared</SelectItem>
              </SelectContent>
            </Select>
            {isHire && workOrder.work_order_type === "Scheduled" && (
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Scheduled hire fleet services are charged to the provider
              </p>
            )}
            {isHire && (workOrder.work_order_type === "Corrective" || workOrder.work_order_type === "DefectRepair") && (
              <p className="text-xs text-slate-500">
                Set this to KPI only if our driver/operations caused the damage. HireProvider means it's covered by the provider's agreement.
              </p>
            )}
          </div>

          {/* Completion Notes */}
          <div className="space-y-2">
            <Label>Completion Notes</Label>
            <Textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes about the completion..."
            />
          </div>

          {/* Confirmation Info */}
          {isHire && canConfirmHire && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-emerald-900 dark:text-emerald-200">
                    Confirmed by: {user?.full_name || user?.email}
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    Role: {userRole}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={isSubmitting || (isHire && !canConfirmHire)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? "Completing..." : "Mark as Completed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}