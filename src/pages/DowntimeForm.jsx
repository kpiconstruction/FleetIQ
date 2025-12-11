import React, { useState } from "react";
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

export default function DowntimeForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedVehicleId = urlParams.get("vehicle_id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    vehicle_id: preselectedVehicleId || "",
    start_datetime: "",
    end_datetime: "",
    downtime_hours: "",
    reason: "",
    cause_category: "",
    caused_by: "",
    chargeable_to: "",
    stand_down_expected: false,
    stand_down_confirmed: false,
    stand_down_credit_ref: "",
    linked_project_code: "",
    linked_work_order_id: "",
    notes: "",
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const cleanData = { ...data };
      if (cleanData.downtime_hours) cleanData.downtime_hours = Number(cleanData.downtime_hours);

      Object.keys(cleanData).forEach((key) => {
        if (cleanData[key] === "" || cleanData[key] === null) delete cleanData[key];
      });

      return base44.entities.AssetDowntimeEvent.create(cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downtimeEvents"] });
      if (preselectedVehicleId) {
        navigate(createPageUrl(`VehicleDetail?id=${preselectedVehicleId}`));
      } else {
        navigate(createPageUrl("Downtime"));
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
        <Link to={preselectedVehicleId ? createPageUrl(`VehicleDetail?id=${preselectedVehicleId}`) : createPageUrl("Downtime")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Log Downtime Event</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Event Details</h2>
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
              <Label htmlFor="reason">Reason *</Label>
              <Select
                value={formData.reason}
                onValueChange={(v) => handleChange("reason", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Service">Service</SelectItem>
                  <SelectItem value="Breakdown">Breakdown</SelectItem>
                  <SelectItem value="Accident">Accident</SelectItem>
                  <SelectItem value="ClientHold">Client Hold</SelectItem>
                  <SelectItem value="AwaitingParts">Awaiting Parts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cause_category">Cause Category</Label>
              <Select
                value={formData.cause_category}
                onValueChange={(v) => handleChange("cause_category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PreventativeService">Preventative Service</SelectItem>
                  <SelectItem value="CorrectiveRepair">Corrective Repair</SelectItem>
                  <SelectItem value="HireProviderDelay">Hire Provider Delay</SelectItem>
                  <SelectItem value="PartsDelay">Parts Delay</SelectItem>
                  <SelectItem value="IncidentRepair">Incident Repair</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_datetime">Start Date/Time *</Label>
              <Input
                id="start_datetime"
                type="datetime-local"
                value={formData.start_datetime}
                onChange={(e) => handleChange("start_datetime", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_datetime">End Date/Time</Label>
              <Input
                id="end_datetime"
                type="datetime-local"
                value={formData.end_datetime}
                onChange={(e) => handleChange("end_datetime", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="downtime_hours">Downtime Hours</Label>
              <Input
                id="downtime_hours"
                type="number"
                step="0.5"
                value={formData.downtime_hours}
                onChange={(e) => handleChange("downtime_hours", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linked_project_code">Project Code</Label>
              <Input
                id="linked_project_code"
                value={formData.linked_project_code}
                onChange={(e) => handleChange("linked_project_code", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Responsibility */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Responsibility</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="caused_by">Caused By *</Label>
              <Select
                value={formData.caused_by}
                onValueChange={(v) => handleChange("caused_by", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KPI">KPI</SelectItem>
                  <SelectItem value="HireProvider">Hire Provider</SelectItem>
                  <SelectItem value="Client">Client</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chargeable_to">Chargeable To</Label>
              <Select
                value={formData.chargeable_to}
                onValueChange={(v) => handleChange("chargeable_to", v)}
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
          </div>
        </div>

        {/* Stand-Down */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Stand-Down</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <Switch
                id="stand_down_expected"
                checked={formData.stand_down_expected}
                onCheckedChange={(v) => handleChange("stand_down_expected", v)}
              />
              <Label htmlFor="stand_down_expected">Stand-Down Expected</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="stand_down_confirmed"
                checked={formData.stand_down_confirmed}
                onCheckedChange={(v) => handleChange("stand_down_confirmed", v)}
              />
              <Label htmlFor="stand_down_confirmed">Stand-Down Confirmed</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="stand_down_credit_ref">Credit Reference</Label>
              <Input
                id="stand_down_credit_ref"
                value={formData.stand_down_credit_ref}
                onChange={(e) => handleChange("stand_down_credit_ref", e.target.value)}
                placeholder="Credit note or reference number"
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
            placeholder="Additional notes about this downtime event..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link to={preselectedVehicleId ? createPageUrl(`VehicleDetail?id=${preselectedVehicleId}`) : createPageUrl("Downtime")}>
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
            Save Downtime Event
          </Button>
        </div>
      </form>
    </div>
  );
}