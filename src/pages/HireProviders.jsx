import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Edit, Building2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function HireProviders() {
  const [open, setOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  const [formData, setFormData] = useState({
    name: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    address: "",
    notes: "",
    status: "Active",
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingProvider) {
        return base44.entities.HireProvider.update(editingProvider.id, data);
      }
      return base44.entities.HireProvider.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hireProviders"] });
      setOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      address: "",
      notes: "",
      status: "Active",
    });
    setEditingProvider(null);
  };

  const handleEdit = (provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name || "",
      contact_name: provider.contact_name || "",
      contact_phone: provider.contact_phone || "",
      contact_email: provider.contact_email || "",
      address: provider.address || "",
      notes: provider.notes || "",
      status: provider.status || "Active",
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanData = { ...formData };
    Object.keys(cleanData).forEach((key) => {
      if (cleanData[key] === "") delete cleanData[key];
    });
    saveMutation.mutate(cleanData);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hire Providers</h1>
          <p className="text-slate-500 mt-1">{providers.length} providers</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingProvider ? "Edit Provider" : "Add Provider"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={saveMutation.isPending}>
                  {editingProvider ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{provider.name}</h3>
                    {provider.contact_name && (
                      <p className="text-sm text-slate-500">{provider.contact_name}</p>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    provider.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }
                >
                  {provider.status}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                {provider.contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {provider.contact_phone}
                  </div>
                )}
                {provider.contact_email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {provider.contact_email}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleEdit(provider)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          ))}
        </div>
      )}

      {!isLoading && providers.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hire providers added yet</p>
        </div>
      )}
    </div>
  );
}