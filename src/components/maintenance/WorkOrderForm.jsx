import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function WorkOrderForm({ 
  open, 
  onOpenChange, 
  vehicleId, 
  vehicle,
  defaultValues = {},
  onSubmit,
  isSubmitting = false
}) {
  const [formData, setFormData] = useState({
    vehicle_id: vehicleId,
    work_order_type: defaultValues.work_order_type || "Corrective",
    raised_from: defaultValues.raised_from || "Manual",
    raised_datetime: defaultValues.raised_datetime || new Date().toISOString(),
    due_date: defaultValues.due_date || "",
    status: defaultValues.status || "Open",
    priority: defaultValues.priority || "Routine",
    odometer_at_raise: defaultValues.odometer_at_raise || vehicle?.current_odometer_km || 0,
    assigned_to_workshop_name: defaultValues.assigned_to_workshop_name || "",
    assigned_to_hire_provider_id: defaultValues.assigned_to_hire_provider_id || "",
    notes_internal: defaultValues.notes_internal || "",
    notes_for_provider: defaultValues.notes_for_provider || "",
    maintenance_plan_id: defaultValues.maintenance_plan_id || "",
    maintenance_template_id: defaultValues.maintenance_template_id || "",
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  const { data: maintenanceTemplates = [] } = useQuery({
    queryKey: ["maintenanceTemplates"],
    queryFn: () => base44.entities.MaintenanceTemplate.filter({ active: true }),
  });

  const handleSubmit = () => {
    // Validate: if work_order_type is Scheduled and raised_from is Schedule, require template
    if (formData.work_order_type === "Scheduled" && formData.raised_from === "Schedule") {
      if (!formData.maintenance_template_id) {
        alert("Scheduled work orders from Schedule require a Maintenance Template");
        return;
      }
    }

    // Clean up empty optional fields
    const cleanData = { ...formData };
    if (!cleanData.maintenance_plan_id) delete cleanData.maintenance_plan_id;
    if (!cleanData.maintenance_template_id) delete cleanData.maintenance_template_id;
    if (!cleanData.assigned_to_hire_provider_id) delete cleanData.assigned_to_hire_provider_id;
    if (!cleanData.due_date) delete cleanData.due_date;

    onSubmit(cleanData);
  };

  const isScheduledFromPlan = formData.work_order_type === "Scheduled" && formData.raised_from === "Schedule";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vehicle Info */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">Vehicle</p>
            <p className="font-semibold">
              {vehicle?.asset_code} ({vehicle?.rego || "N/A"})
            </p>
          </div>

          {isScheduledFromPlan && (
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Scheduled work orders from Schedule require a Maintenance Template
              </AlertDescription>
            </Alert>
          )}

          {/* Work Order Type and Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Work Order Type *</Label>
              <Select
                value={formData.work_order_type}
                onValueChange={(v) => setFormData({ ...formData, work_order_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Corrective">Corrective</SelectItem>
                  <SelectItem value="DefectRepair">Defect Repair</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Raised From *</Label>
              <Select
                value={formData.raised_from}
                onValueChange={(v) => setFormData({ ...formData, raised_from: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Schedule">Schedule</SelectItem>
                  <SelectItem value="PrestartDefect">Prestart Defect</SelectItem>
                  <SelectItem value="Incident">Incident</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority *</Label>
              <Select
                value={formData.priority}
                onValueChange={(v) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="Major">Major</SelectItem>
                  <SelectItem value="SafetyCritical">Safety Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          {/* Odometer */}
          <div className="space-y-2">
            <Label>Odometer at Raise (km)</Label>
            <Input
              type="number"
              value={formData.odometer_at_raise}
              onChange={(e) =>
                setFormData({ ...formData, odometer_at_raise: parseFloat(e.target.value) || 0 })
              }
            />
          </div>

          {/* Template (optional unless scheduled from plan) */}
          <div className="space-y-2">
            <Label>
              Maintenance Template {isScheduledFromPlan && "*"}
            </Label>
            <Select
              value={formData.maintenance_template_id}
              onValueChange={(v) => setFormData({ ...formData, maintenance_template_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="None (Ad-hoc)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None (Ad-hoc)</SelectItem>
                {maintenanceTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Workshop Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assigned Workshop</Label>
              <Input
                value={formData.assigned_to_workshop_name}
                onChange={(e) =>
                  setFormData({ ...formData, assigned_to_workshop_name: e.target.value })
                }
                placeholder="Workshop name"
              />
            </div>

            <div className="space-y-2">
              <Label>Assigned Hire Provider</Label>
              <Select
                value={formData.assigned_to_hire_provider_id}
                onValueChange={(v) => setFormData({ ...formData, assigned_to_hire_provider_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {hireProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes for Provider */}
          <div className="space-y-2">
            <Label>Instructions for Provider</Label>
            <Textarea
              value={formData.notes_for_provider}
              onChange={(e) =>
                setFormData({ ...formData, notes_for_provider: e.target.value })
              }
              rows={3}
              placeholder="Work to be performed..."
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              value={formData.notes_internal}
              onChange={(e) =>
                setFormData({ ...formData, notes_internal: e.target.value })
              }
              rows={2}
              placeholder="Internal tracking notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isSubmitting ? "Creating..." : "Create Work Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}