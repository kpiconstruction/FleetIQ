import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ServiceForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedVehicleId = urlParams.get("vehicle_id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    vehicle_id: preselectedVehicleId || "",
    service_date: new Date().toISOString().split("T")[0],
    odometer_km: "",
    engine_hours: "",
    service_type: "",
    workshop_name: "",
    hire_provider_id: "",
    cost_ex_gst: "",
    invoice_number: "",
    downtime_start: "",
    downtime_end: "",
    downtime_hours: "",
    downtime_reason: "",
    downtime_chargeable_to: "",
    downtime_billable_flag: false,
    hire_credit_reference: "",
    notes: "",
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  const selectedVehicle = vehicles.find((v) => v.id === formData.vehicle_id);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const cleanData = { ...data };
      if (cleanData.odometer_km) cleanData.odometer_km = Number(cleanData.odometer_km);
      if (cleanData.engine_hours) cleanData.engine_hours = Number(cleanData.engine_hours);
      if (cleanData.cost_ex_gst) cleanData.cost_ex_gst = Number(cleanData.cost_ex_gst);
      if (cleanData.downtime_hours) cleanData.downtime_hours = Number(cleanData.downtime_hours);

      Object.keys(cleanData).forEach((key) => {
        if (cleanData[key] === "" || cleanData[key] === null) delete cleanData[key];
      });

      return base44.entities.ServiceRecord.create(cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceRecords"] });
      if (preselectedVehicleId) {
        navigate(createPageUrl(`VehicleDetail?id=${preselectedVehicleId}`));
      } else {
        navigate(createPageUrl("Service"));
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to={preselectedVehicleId ? createPageUrl(`VehicleDetail?id=${preselectedVehicleId}`) : createPageUrl("Service")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Add Service Record</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Vehicle & Basic Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Service Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_id">Vehicle *</Label>
              <Select
                value={formData.vehicle_id}
                onValueChange={(v) => handleChange("vehicle_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.asset_code} - {v.rego}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_date">Service Date *</Label>
              <Input
                id="service_date"
                type="date"
                value={formData.service_date}
                onChange={(e) => handleChange("service_date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type *</Label>
              <Select
                value={formData.service_type}
                onValueChange={(v) => handleChange("service_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Unscheduled">Unscheduled</SelectItem>
                  <SelectItem value="Breakdown">Breakdown</SelectItem>
                  <SelectItem value="Warranty">Warranty</SelectItem>
                  <SelectItem value="HireProviderService">Hire Provider Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workshop_name">Workshop Name</Label>
              <Input
                id="workshop_name"
                value={formData.workshop_name}
                onChange={(e) => handleChange("workshop_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odometer_km">Odometer (km)</Label>
              <Input
                id="odometer_km"
                type="number"
                value={formData.odometer_km}
                onChange={(e) => handleChange("odometer_km", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="engine_hours">Engine Hours</Label>
              <Input
                id="engine_hours"
                type="number"
                value={formData.engine_hours}
                onChange={(e) => handleChange("engine_hours", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Cost */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Cost Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_ex_gst">Cost (ex GST)</Label>
              <Input
                id="cost_ex_gst"
                type="number"
                step="0.01"
                value={formData.cost_ex_gst}
                onChange={(e) => handleChange("cost_ex_gst", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => handleChange("invoice_number", e.target.value)}
              />
            </div>
            {selectedVehicle?.ownership_type !== "Owned" && (
              <div className="space-y-2">
                <Label htmlFor="hire_provider_id">Hire Provider</Label>
                <Select
                  value={formData.hire_provider_id}
                  onValueChange={(v) => handleChange("hire_provider_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {hireProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Downtime */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Downtime Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="downtime_start">Downtime Start</Label>
              <Input
                id="downtime_start"
                type="datetime-local"
                value={formData.downtime_start}
                onChange={(e) => handleChange("downtime_start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="downtime_end">Downtime End</Label>
              <Input
                id="downtime_end"
                type="datetime-local"
                value={formData.downtime_end}
                onChange={(e) => handleChange("downtime_end", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="downtime_hours">Downtime Hours</Label>
              <Input
                id="downtime_hours"
                type="number"
                value={formData.downtime_hours}
                onChange={(e) => handleChange("downtime_hours", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="downtime_chargeable_to">Chargeable To</Label>
              <Select
                value={formData.downtime_chargeable_to}
                onValueChange={(v) => handleChange("downtime_chargeable_to", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KPI">KPI</SelectItem>
                  <SelectItem value="HireProvider">Hire Provider</SelectItem>
                  <SelectItem value="Client">Client</SelectItem>
                  <SelectItem value="Shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="downtime_reason">Downtime Reason</Label>
              <Input
                id="downtime_reason"
                value={formData.downtime_reason}
                onChange={(e) => handleChange("downtime_reason", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="downtime_billable_flag"
                checked={formData.downtime_billable_flag}
                onCheckedChange={(v) => handleChange("downtime_billable_flag", v)}
              />
              <Label htmlFor="downtime_billable_flag">Billable Downtime</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hire_credit_reference">Hire Credit Reference</Label>
              <Input
                id="hire_credit_reference"
                value={formData.hire_credit_reference}
                onChange={(e) => handleChange("hire_credit_reference", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes</h2>
          <Textarea
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={4}
            placeholder="Additional notes about this service..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link to={preselectedVehicleId ? createPageUrl(`VehicleDetail?id=${preselectedVehicleId}`) : createPageUrl("Service")}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Service Record
          </Button>
        </div>
      </form>
    </div>
  );
}