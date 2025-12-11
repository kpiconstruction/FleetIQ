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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function VehicleForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const vehicleId = urlParams.get("id");
  const isEdit = !!vehicleId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    asset_code: "",
    rego: "",
    vin: "",
    asset_type: "",
    vehicle_function_class: "",
    tma_variant: "",
    assignar_tracked: true,
    assignar_asset_id: "",
    make: "",
    model: "",
    year: "",
    state: "",
    primary_depot: "",
    status: "Active",
    ownership_type: "Owned",
    hire_provider_id: "",
    in_service_date: "",
    current_odometer_km: "",
    next_service_due_km: "",
    next_service_due_date: "",
    notes: "",
  });

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => base44.entities.Vehicle.filter({ id: vehicleId }),
    enabled: isEdit,
    select: (data) => data[0],
  });

  const { data: hireProviders = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  useEffect(() => {
    if (vehicle) {
      setFormData({
        asset_code: vehicle.asset_code || "",
        rego: vehicle.rego || "",
        vin: vehicle.vin || "",
        asset_type: vehicle.asset_type || "",
        vehicle_function_class: vehicle.vehicle_function_class || "",
        tma_variant: vehicle.tma_variant || "",
        assignar_tracked: vehicle.assignar_tracked !== undefined ? vehicle.assignar_tracked : true,
        assignar_asset_id: vehicle.assignar_asset_id || "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year || "",
        state: vehicle.state || "",
        primary_depot: vehicle.primary_depot || "",
        status: vehicle.status || "Active",
        ownership_type: vehicle.ownership_type || "Owned",
        hire_provider_id: vehicle.hire_provider_id || "",
        in_service_date: vehicle.in_service_date || "",
        current_odometer_km: vehicle.current_odometer_km || "",
        next_service_due_km: vehicle.next_service_due_km || "",
        next_service_due_date: vehicle.next_service_due_date || "",
        notes: vehicle.notes || "",
      });
    }
  }, [vehicle]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const cleanData = { ...data };
      if (cleanData.year) cleanData.year = Number(cleanData.year);
      if (cleanData.current_odometer_km) cleanData.current_odometer_km = Number(cleanData.current_odometer_km);
      if (cleanData.next_service_due_km) cleanData.next_service_due_km = Number(cleanData.next_service_due_km);
      
      // Remove empty strings for optional fields
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "") delete cleanData[key];
      });

      if (isEdit) {
        return base44.entities.Vehicle.update(vehicleId, cleanData);
      }
      return base44.entities.Vehicle.create(cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      navigate(createPageUrl("Vehicles"));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      
      // Auto-set assignar_tracked = false when CorporateCar is selected
      if (field === "vehicle_function_class" && value === "CorporateCar") {
        newData.assignar_tracked = false;
      }
      
      // Clear tma_variant when vehicle_function_class changes away from TMA
      if (field === "vehicle_function_class" && value !== "TMA") {
        newData.tma_variant = "";
      }
      
      // Clear assignar_asset_id when assignar_tracked is false
      if (field === "assignar_tracked" && !value) {
        newData.assignar_asset_id = "";
      }
      
      return newData;
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to={createPageUrl("Vehicles")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEdit ? "Edit Vehicle" : "Add Vehicle"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asset_code">Asset Code *</Label>
              <Input
                id="asset_code"
                value={formData.asset_code}
                onChange={(e) => handleChange("asset_code", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rego">Registration</Label>
              <Input
                id="rego"
                value={formData.rego}
                onChange={(e) => handleChange("rego", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vin">VIN</Label>
              <Input
                id="vin"
                value={formData.vin}
                onChange={(e) => handleChange("vin", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset_type">Asset Type *</Label>
              <Select
                value={formData.asset_type}
                onValueChange={(v) => handleChange("asset_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TMA">TMA</SelectItem>
                  <SelectItem value="Pod Truck">Pod Truck</SelectItem>
                  <SelectItem value="Traffic Ute">Traffic Ute</SelectItem>
                  <SelectItem value="Plant">Plant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_function_class">Vehicle Functional Class *</Label>
              <Select
                value={formData.vehicle_function_class}
                onValueChange={(v) => handleChange("vehicle_function_class", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select functional class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CorporateCar">Corporate Car</SelectItem>
                  <SelectItem value="TrafficUte">Traffic Ute</SelectItem>
                  <SelectItem value="VMSUte">VMS Ute</SelectItem>
                  <SelectItem value="PodTruckCar">Pod Truck Car</SelectItem>
                  <SelectItem value="PodTruckTruck">Pod Truck Truck</SelectItem>
                  <SelectItem value="TMA">TMA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.vehicle_function_class === "TMA" && (
              <div className="space-y-2">
                <Label htmlFor="tma_variant">TMA Variant</Label>
                <Select
                  value={formData.tma_variant}
                  onValueChange={(v) => handleChange("tma_variant", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select TMA variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blades">Blades</SelectItem>
                    <SelectItem value="Silke">Silke</SelectItem>
                    <SelectItem value="Julietta">Julietta</SelectItem>
                    <SelectItem value="Scorpion">Scorpion</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="make">Make</Label>
              <Input
                id="make"
                value={formData.make}
                onChange={(e) => handleChange("make", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleChange("model", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => handleChange("year", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Location & Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Select
                value={formData.state}
                onValueChange={(v) => handleChange("state", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIC">VIC</SelectItem>
                  <SelectItem value="NSW">NSW</SelectItem>
                  <SelectItem value="QLD">QLD</SelectItem>
                  <SelectItem value="SA">SA</SelectItem>
                  <SelectItem value="WA">WA</SelectItem>
                  <SelectItem value="TAS">TAS</SelectItem>
                  <SelectItem value="NT">NT</SelectItem>
                  <SelectItem value="ACT">ACT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_depot">Primary Depot</Label>
              <Input
                id="primary_depot"
                value={formData.primary_depot}
                onChange={(e) => handleChange("primary_depot", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => handleChange("status", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="In Maintenance">In Maintenance</SelectItem>
                  <SelectItem value="Decommissioned">Decommissioned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="in_service_date">In Service Date</Label>
              <Input
                id="in_service_date"
                type="date"
                value={formData.in_service_date}
                onChange={(e) => handleChange("in_service_date", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Assignar Tracking */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Assignar Tracking</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="assignar_tracked"
                checked={formData.assignar_tracked}
                onCheckedChange={(v) => handleChange("assignar_tracked", v)}
              />
              <Label htmlFor="assignar_tracked" className="cursor-pointer">
                Track in Assignar
              </Label>
            </div>
            {formData.assignar_tracked && (
              <div className="space-y-2">
                <Label htmlFor="assignar_asset_id">Assignar Asset ID</Label>
                <Input
                  id="assignar_asset_id"
                  value={formData.assignar_asset_id}
                  onChange={(e) => handleChange("assignar_asset_id", e.target.value)}
                  placeholder="Enter Assignar asset ID"
                />
              </div>
            )}
          </div>
        </div>

        {/* Ownership */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Ownership</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ownership_type">Ownership Type *</Label>
              <Select
                value={formData.ownership_type}
                onValueChange={(v) => handleChange("ownership_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ownership" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Owned">Owned</SelectItem>
                  <SelectItem value="ContractHire">Contract Hire</SelectItem>
                  <SelectItem value="DayHire">Day Hire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.ownership_type !== "Owned" && (
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

        {/* Service */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Service Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_odometer_km">Current Odometer (km)</Label>
              <Input
                id="current_odometer_km"
                type="number"
                value={formData.current_odometer_km}
                onChange={(e) => handleChange("current_odometer_km", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_service_due_km">Next Service Due (km)</Label>
              <Input
                id="next_service_due_km"
                type="number"
                value={formData.next_service_due_km}
                onChange={(e) => handleChange("next_service_due_km", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_service_due_date">Next Service Due Date</Label>
              <Input
                id="next_service_due_date"
                type="date"
                value={formData.next_service_due_date}
                onChange={(e) => handleChange("next_service_due_date", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Notes</h2>
          <Textarea
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={4}
            placeholder="Any additional notes about this vehicle..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link to={createPageUrl("Vehicles")}>
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
            {isEdit ? "Update Vehicle" : "Create Vehicle"}
          </Button>
        </div>
      </form>
    </div>
  );
}