import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { Plus, Edit, FileText, DollarSign, Calendar } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Contracts() {
  const [open, setOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => base44.entities.HireContract.list("-start_date"),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["hireProviders"],
    queryFn: () => base44.entities.HireProvider.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const providerMap = useMemo(() => {
    return providers.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});
  }, [providers]);

  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, {});
  }, [vehicles]);

  const [formData, setFormData] = useState({
    hire_provider_id: "",
    vehicle_id: "",
    contract_name: "",
    contract_reference: "",
    start_date: "",
    end_date: "",
    rate_basis: "",
    rate_amount: "",
    status: "Active",
    notes: "",
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const cleanData = { ...data };
      if (cleanData.rate_amount) cleanData.rate_amount = Number(cleanData.rate_amount);
      Object.keys(cleanData).forEach((key) => {
        if (cleanData[key] === "") delete cleanData[key];
      });
      
      if (editingContract) {
        return base44.entities.HireContract.update(editingContract.id, cleanData);
      }
      return base44.entities.HireContract.create(cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      hire_provider_id: "",
      vehicle_id: "",
      contract_name: "",
      contract_reference: "",
      start_date: "",
      end_date: "",
      rate_basis: "",
      rate_amount: "",
      status: "Active",
      notes: "",
    });
    setEditingContract(null);
  };

  const handleEdit = (contract) => {
    setEditingContract(contract);
    setFormData({
      hire_provider_id: contract.hire_provider_id || "",
      vehicle_id: contract.vehicle_id || "",
      contract_name: contract.contract_name || "",
      contract_reference: contract.contract_reference || "",
      start_date: contract.start_date || "",
      end_date: contract.end_date || "",
      rate_basis: contract.rate_basis || "",
      rate_amount: contract.rate_amount?.toString() || "",
      status: contract.status || "Active",
      notes: contract.notes || "",
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const getStatusBadge = (status) => {
    const styles = {
      Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Expired: "bg-slate-100 text-slate-600 border-slate-200",
      Terminated: "bg-rose-50 text-rose-700 border-rose-200",
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.Active}>
        {status}
      </Badge>
    );
  };

  const getRateBasisLabel = (basis) => {
    const labels = {
      per_day: "/day",
      per_week: "/week",
      per_month: "/month",
      per_hour: "/hour",
      per_km: "/km",
    };
    return labels[basis] || basis;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Hire Contracts</h1>
          <p className="text-slate-500 mt-1">{contracts.length} contracts</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingContract ? "Edit Contract" : "Add Contract"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="hire_provider_id">Hire Provider *</Label>
                <Select
                  value={formData.hire_provider_id}
                  onValueChange={(v) => setFormData({ ...formData, hire_provider_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_id">Vehicle</Label>
                <Select
                  value={formData.vehicle_id}
                  onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.filter((v) => v.ownership_type !== "Owned").map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.asset_code} - {v.rego}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contract_name">Contract Name *</Label>
                  <Input
                    id="contract_name"
                    value={formData.contract_name}
                    onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract_reference">Reference</Label>
                  <Input
                    id="contract_reference"
                    value={formData.contract_reference}
                    onChange={(e) => setFormData({ ...formData, contract_reference: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate_basis">Rate Basis *</Label>
                  <Select
                    value={formData.rate_basis}
                    onValueChange={(v) => setFormData({ ...formData, rate_basis: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_day">Per Day</SelectItem>
                      <SelectItem value="per_week">Per Week</SelectItem>
                      <SelectItem value="per_month">Per Month</SelectItem>
                      <SelectItem value="per_hour">Per Hour</SelectItem>
                      <SelectItem value="per_km">Per Km</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate_amount">Rate Amount *</Label>
                  <Input
                    id="rate_amount"
                    type="number"
                    step="0.01"
                    value={formData.rate_amount}
                    onChange={(e) => setFormData({ ...formData, rate_amount: e.target.value })}
                    required
                  />
                </div>
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
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
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
                  {editingContract ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Contract</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => {
                const provider = providerMap[contract.hire_provider_id];
                const vehicle = vehicleMap[contract.vehicle_id];
                return (
                  <TableRow key={contract.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div>
                        <p className="font-medium">{contract.contract_name}</p>
                        {contract.contract_reference && (
                          <p className="text-sm text-slate-500">{contract.contract_reference}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{provider?.name || "-"}</TableCell>
                    <TableCell>{vehicle?.asset_code || "-"}</TableCell>
                    <TableCell className="font-medium">
                      ${contract.rate_amount}{getRateBasisLabel(contract.rate_basis)}
                    </TableCell>
                    <TableCell>{format(new Date(contract.start_date), "d MMM yyyy")}</TableCell>
                    <TableCell>
                      {contract.end_date ? format(new Date(contract.end_date), "d MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(contract)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {contracts.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No contracts added yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}