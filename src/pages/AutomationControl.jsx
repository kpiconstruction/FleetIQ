import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "../components/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Zap, AlertTriangle, Save, RefreshCw, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AutomationControl() {
  const { isFleetAdmin, can, fleetRole } = usePermissions();
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["automationConfigs"],
    queryFn: () => base44.entities.AutomationConfig.list(),
  });

  const { data: alertLogs = [] } = useQuery({
    queryKey: ["alertLogs"],
    queryFn: () => base44.entities.AlertLog.list("-sent_at", 50),
  });

  const createOrUpdateMutation = useMutation({
    mutationFn: async (configData) => {
      const existing = configs.find(c => c.key === configData.key);
      if (existing) {
        return base44.entities.AutomationConfig.update(existing.id, configData);
      } else {
        return base44.entities.AutomationConfig.create(configData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automationConfigs"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const getConfigValue = (key, defaultValue = "") => {
    const config = configs.find(c => c.key === key);
    if (!config) return defaultValue;
    
    if (config.value_type === "boolean") {
      return config.value === "true";
    } else if (config.value_type === "number") {
      return parseInt(config.value) || 0;
    }
    return config.value;
  };

  const handleSaveConfig = (key, value, valueType, description, category) => {
    if (!can.editAutomationSettings) {
      alert("You do not have permission to edit automation settings.");
      return;
    }
    createOrUpdateMutation.mutate({
      key,
      value: String(value),
      value_type: valueType,
      description,
      category,
      editable_by_role: "FleetAdmin"
    });
  };

  if (!can.editAutomationSettings) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
          <Lock className="w-16 h-16 text-rose-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-600 mb-4">
            Only Fleet Admins can access automation settings.
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
            <Settings className="w-8 h-8 text-indigo-600" />
            Fleet IQ Automation Control
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure automated work order creation, alerting, and reporting
          </p>
        </div>
        {saveSuccess && (
          <Alert className="w-auto bg-emerald-50 border-emerald-200">
            <AlertDescription className="text-emerald-700">
              Settings saved successfully
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Tabs defaultValue="workorders" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="workorders">Work Order Automation</TabsTrigger>
          <TabsTrigger value="alerting">Alerting</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
          <TabsTrigger value="logs">Alert Logs</TabsTrigger>
        </TabsList>

        {/* Work Order Automation Tab */}
        <TabsContent value="workorders">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plan-Based WOs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  Plan-Based Work Orders
                </CardTitle>
                <CardDescription>
                  Automatically create work orders from upcoming maintenance plans
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-wo-plans">Enable Automation</Label>
                  <Switch
                    id="auto-wo-plans"
                    checked={getConfigValue("AUTO_WO_FROM_PLANS_ENABLED", true)}
                    onCheckedChange={(checked) =>
                      handleSaveConfig(
                        "AUTO_WO_FROM_PLANS_ENABLED",
                        checked,
                        "boolean",
                        "Enable automatic work order creation from maintenance plans",
                        "WorkOrderAutomation"
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-due-days">Create WO When Due Within (days)</Label>
                  <Input
                    id="plan-due-days"
                    type="number"
                    min="1"
                    value={getConfigValue("AUTO_WO_PLAN_DUE_DAYS", 14)}
                    onChange={(e) =>
                      handleSaveConfig(
                        "AUTO_WO_PLAN_DUE_DAYS",
                        e.target.value,
                        "number",
                        "Number of days before due date to auto-create work orders",
                        "WorkOrderAutomation"
                      )
                    }
                    onBlur={(e) =>
                      handleSaveConfig(
                        "AUTO_WO_PLAN_DUE_DAYS",
                        e.target.value,
                        "number",
                        "Number of days before due date to auto-create work orders",
                        "WorkOrderAutomation"
                      )
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Work orders will be created when a plan is due within this many days
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Defect-Based WOs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-rose-600" />
                  Defect-Based Work Orders
                </CardTitle>
                <CardDescription>
                  Automatically create work orders from critical prestart defects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-wo-defects">Enable Automation</Label>
                  <Switch
                    id="auto-wo-defects"
                    checked={getConfigValue("AUTO_WO_FROM_DEFECTS_ENABLED", true)}
                    onCheckedChange={(checked) =>
                      handleSaveConfig(
                        "AUTO_WO_FROM_DEFECTS_ENABLED",
                        checked,
                        "boolean",
                        "Enable automatic work order creation from critical/high defects",
                        "WorkOrderAutomation"
                      )
                    }
                  />
                </div>
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Work orders are automatically created for High and Critical severity defects
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerting Tab */}
        <TabsContent value="alerting">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Worker Risk Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Worker Risk Alerts</CardTitle>
                <CardDescription>
                  Email notifications for worker risk level changes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="alert-risk-amber">Amber Risk Alerts</Label>
                  <Switch
                    id="alert-risk-amber"
                    checked={getConfigValue("ALERT_WORKER_RISK_AMBER_ENABLED", true)}
                    onCheckedChange={(checked) =>
                      handleSaveConfig(
                        "ALERT_WORKER_RISK_AMBER_ENABLED",
                        checked,
                        "boolean",
                        "Send alerts when worker risk level becomes Amber",
                        "Alerting"
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="alert-risk-red">Red Risk Alerts</Label>
                  <Switch
                    id="alert-risk-red"
                    checked={getConfigValue("ALERT_WORKER_RISK_RED_ENABLED", true)}
                    onCheckedChange={(checked) =>
                      handleSaveConfig(
                        "ALERT_WORKER_RISK_RED_ENABLED",
                        checked,
                        "boolean",
                        "Send alerts when worker risk level becomes Red",
                        "Alerting"
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Defect Escalation */}
            <Card>
              <CardHeader>
                <CardTitle>Defect Escalation Alerts</CardTitle>
                <CardDescription>
                  Alert when high-severity defects remain open
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="defect-high-hours">High Severity Alert After (hours)</Label>
                  <Input
                    id="defect-high-hours"
                    type="number"
                    min="1"
                    value={getConfigValue("DEFECT_HIGH_ALERT_HOURS", 24)}
                    onChange={(e) =>
                      handleSaveConfig(
                        "DEFECT_HIGH_ALERT_HOURS",
                        e.target.value,
                        "number",
                        "Alert if high severity defect open for this many hours",
                        "Alerting"
                      )
                    }
                    onBlur={(e) =>
                      handleSaveConfig(
                        "DEFECT_HIGH_ALERT_HOURS",
                        e.target.value,
                        "number",
                        "Alert if high severity defect open for this many hours",
                        "Alerting"
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defect-critical-hours">Critical Severity Alert After (hours)</Label>
                  <Input
                    id="defect-critical-hours"
                    type="number"
                    min="1"
                    value={getConfigValue("DEFECT_CRITICAL_ALERT_HOURS", 4)}
                    onChange={(e) =>
                      handleSaveConfig(
                        "DEFECT_CRITICAL_ALERT_HOURS",
                        e.target.value,
                        "number",
                        "Alert if critical severity defect open for this many hours",
                        "Alerting"
                      )
                    }
                    onBlur={(e) =>
                      handleSaveConfig(
                        "DEFECT_CRITICAL_ALERT_HOURS",
                        e.target.value,
                        "number",
                        "Alert if critical severity defect open for this many hours",
                        "Alerting"
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reporting Tab */}
        <TabsContent value="reporting">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reporting</CardTitle>
              <CardDescription>
                Configure automatic report generation and distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800">
                  Scheduled reporting features are configured through backend scheduled jobs. Monthly HVNL and compliance reports are automatically generated on the 1st of each month.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent Alert Activity</CardTitle>
              <CardDescription>Last 50 automated alerts sent by the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alertLogs.length === 0 && (
                  <p className="text-center py-8 text-slate-500">No alerts sent yet</p>
                )}
                {alertLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      log.status === "Success"
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-rose-50 border-rose-200"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{log.subject}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          To: {log.recipients} • {new Date(log.sent_at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          log.status === "Success"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-rose-600 mt-2">{log.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}