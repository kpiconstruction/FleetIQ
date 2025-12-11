import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "../components/auth/usePermissions";
import { Mail, Plus, Save, Trash2, Lock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NotificationSettings() {
  const { can, isFleetAdmin, fleetRole } = usePermissions();
  const [editingConfig, setEditingConfig] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newConfig, setNewConfig] = useState({ key: "", value: "", description: "" });
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["notificationConfigs"],
    queryFn: () => base44.entities.NotificationConfig.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotificationConfig.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationConfigs"] });
      setEditingConfig(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.NotificationConfig.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationConfigs"] });
      setAddDialogOpen(false);
      setNewConfig({ key: "", value: "", description: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.NotificationConfig.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationConfigs"] });
    },
  });

  const handleSave = (config) => {
    updateMutation.mutate({
      id: config.id,
      data: {
        value: config.value,
        description: config.description,
      },
    });
  };

  const handleAdd = () => {
    if (!newConfig.key || !newConfig.value) return;
    createMutation.mutate(newConfig);
  };

  if (!isFleetAdmin) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
          <Lock className="w-16 h-16 text-rose-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-600 mb-4">
            Only Fleet Admins can manage notification settings.
          </p>
          <p className="text-sm text-slate-500">
            Your current role: <strong>{fleetRole || "Viewer"}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-8 h-8 text-indigo-600" />
            Notification Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure email recipients for maintenance and compliance alerts
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="bg-indigo-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Recipient
        </Button>
      </div>

      <Alert className="mb-6">
        <Mail className="w-4 h-4" />
        <AlertDescription>
          These email addresses are used by automated notification functions for maintenance alerts, HVNL compliance, and risk notifications.
        </AlertDescription>
      </Alert>

      {/* Notification Configs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Email Recipients</CardTitle>
          <CardDescription>
            Manage notification recipients by key
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-slate-500">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Key</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => {
                  const isEditing = editingConfig?.id === config.id;
                  return (
                    <TableRow key={config.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-sm">{config.key}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="email"
                            value={editingConfig.value}
                            onChange={(e) =>
                              setEditingConfig({ ...editingConfig, value: e.target.value })
                            }
                            className="w-64"
                          />
                        ) : (
                          <span className="font-medium">{config.value}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editingConfig.description || ""}
                            onChange={(e) =>
                              setEditingConfig({ ...editingConfig, description: e.target.value })
                            }
                            className="w-full"
                          />
                        ) : (
                          <span className="text-sm text-slate-600">{config.description || "-"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSave(editingConfig)}
                                disabled={updateMutation.isPending}
                              >
                                <Save className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingConfig(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingConfig({ ...config })}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Delete this notification config?")) {
                                    deleteMutation.mutate(config.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {configs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      No notification configs yet. Add your first recipient.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Suggested Keys */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Suggested Configuration Keys</CardTitle>
          <CardDescription>Common notification recipient keys used by Fleet IQ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-mono text-indigo-600">FleetManagerEmail</p>
              <p className="text-slate-600 text-xs">Fleet Manager for maintenance & HVNL alerts</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-mono text-indigo-600">HSEManagerEmail</p>
              <p className="text-slate-600 text-xs">HSE Manager for HVNL-critical alerts</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-mono text-indigo-600">StateOpsEmail_VIC</p>
              <p className="text-slate-600 text-xs">VIC State Operations Manager</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-mono text-indigo-600">StateOpsEmail_NSW</p>
              <p className="text-slate-600 text-xs">NSW State Operations Manager</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-mono text-indigo-600">StateOpsEmail_QLD</p>
              <p className="text-slate-600 text-xs">QLD State Operations Manager</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-mono text-indigo-600">StateOpsEmail_TAS</p>
              <p className="text-slate-600 text-xs">TAS State Operations Manager</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Config Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Notification Recipient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Key *</Label>
              <Input
                placeholder="e.g. FleetManagerEmail"
                value={newConfig.key}
                onChange={(e) => setNewConfig({ ...newConfig, key: e.target.value })}
              />
              <p className="text-xs text-slate-500">Use suggested keys or create custom ones</p>
            </div>
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={newConfig.value}
                onChange={(e) => setNewConfig({ ...newConfig, value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Purpose of this notification recipient"
                value={newConfig.description}
                onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!newConfig.key || !newConfig.value || createMutation.isPending}
              className="bg-indigo-600"
            >
              Add Recipient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}