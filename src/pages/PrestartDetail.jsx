import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import {
  ArrowLeft,
  User,
  MapPin,
  Gauge,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PrestartDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const prestartId = urlParams.get("id");

  const { data: prestart, isLoading: prestartLoading } = useQuery({
    queryKey: ["prestart", prestartId],
    queryFn: () => base44.entities.PrestartCheck.filter({ id: prestartId }),
    enabled: !!prestartId,
    select: (data) => data[0],
  });

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", prestart?.vehicle_id],
    queryFn: () => base44.entities.Vehicle.filter({ id: prestart.vehicle_id }),
    enabled: !!prestart?.vehicle_id,
    select: (data) => data[0],
  });

  const { data: prestartItems = [] } = useQuery({
    queryKey: ["prestartItems", prestartId],
    queryFn: () => base44.entities.PrestartItem.filter({ prestart_id: prestartId }),
    enabled: !!prestartId,
  });

  const { data: prestartEvidence = [] } = useQuery({
    queryKey: ["prestartEvidence", prestartId],
    queryFn: () => base44.entities.PrestartEvidence.filter({ prestart_id: prestartId }),
    enabled: !!prestartId,
  });

  const { data: prestartDefects = [] } = useQuery({
    queryKey: ["prestartDefects", prestartId],
    queryFn: () => base44.entities.PrestartDefect.filter({ prestart_id: prestartId }),
    enabled: !!prestartId,
  });

  // Group items by category
  const itemsByCategory = prestartItems.reduce((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (prestartLoading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!prestart) {
    return (
      <div className="p-6 lg:p-8">
        <p>Prestart not found</p>
      </div>
    );
  }

  const getResultBadge = (result) => {
    if (result === "PASS") {
      return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    }
    if (result === "FAIL") {
      return <XCircle className="w-5 h-5 text-rose-500" />;
    }
    return <span className="text-slate-400">N/A</span>;
  };

  const getSeverityColor = (severity) => {
    const colors = {
      Low: "bg-blue-50 text-blue-700 border-blue-200",
      Medium: "bg-amber-50 text-amber-700 border-amber-200",
      High: "bg-orange-50 text-orange-700 border-orange-200",
      Critical: "bg-rose-50 text-rose-700 border-rose-200",
    };
    return colors[severity] || colors.Medium;
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl("Prestarts")}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Prestart Check</h1>
            <Badge
              variant="outline"
              className={
                prestart.overall_result === "Pass"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }
            >
              {prestart.overall_result === "Pass" ? (
                <CheckCircle className="w-3 h-3 mr-1" />
              ) : (
                <XCircle className="w-3 h-3 mr-1" />
              )}
              {prestart.overall_result}
            </Badge>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            {format(new Date(prestart.prestart_datetime), "d MMMM yyyy, HH:mm")}
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <User className="w-4 h-4" />
            <span className="text-sm">Operator</span>
          </div>
          <p className="font-semibold">{prestart.operator_name}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <span className="text-sm">Vehicle</span>
          </div>
          <Link
            to={createPageUrl(`VehicleDetail?id=${prestart.vehicle_id}`)}
            className="font-semibold text-indigo-600 hover:underline"
          >
            {vehicle?.asset_code} ({vehicle?.rego})
          </Link>
        </div>
        {prestart.odometer_km && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Gauge className="w-4 h-4" />
              <span className="text-sm">Odometer</span>
            </div>
            <p className="font-semibold">{prestart.odometer_km.toLocaleString()} km</p>
          </div>
        )}
        {prestart.client_name && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <span className="text-sm">Client/Project</span>
            </div>
            <p className="font-semibold">{prestart.client_name}</p>
            {prestart.project_name && (
              <p className="text-sm text-slate-500">{prestart.project_name}</p>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="items" className="rounded-lg">
            Check Items ({prestartItems.length})
          </TabsTrigger>
          <TabsTrigger value="photos" className="rounded-lg">
            Photos ({prestartEvidence.length})
          </TabsTrigger>
          <TabsTrigger value="defects" className="rounded-lg">
            Defects ({prestartDefects.length})
          </TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items">
          {Object.entries(itemsByCategory).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(itemsByCategory).map(([category, items]) => (
                <div key={category} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">{category}</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <div key={item.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{item.item_label}</p>
                          {item.notes && (
                            <p className="text-sm text-slate-500 mt-1">{item.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {item.defect_flag && (
                            <Badge variant="outline" className={getSeverityColor(item.severity)}>
                              {item.severity}
                            </Badge>
                          )}
                          {getResultBadge(item.result)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
              <p className="text-slate-500">No check items recorded</p>
            </div>
          )}
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos">
          {prestartEvidence.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {prestartEvidence.map((evidence) => (
                <div key={evidence.id} className="relative group">
                  <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={evidence.image_url}
                      alt={evidence.image_type}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Badge
                    variant="outline"
                    className={`absolute top-2 left-2 ${
                      evidence.image_type === "Defect Evidence"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-white"
                    }`}
                  >
                    {evidence.image_type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No photos attached</p>
            </div>
          )}
        </TabsContent>

        {/* Defects Tab */}
        <TabsContent value="defects">
          {prestartDefects.length > 0 ? (
            <div className="space-y-4">
              {prestartDefects.map((defect) => (
                <div key={defect.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <Badge variant="outline" className={getSeverityColor(defect.severity)}>
                        {defect.severity}
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        defect.status === "Closed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : defect.status === "In Repair"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }
                    >
                      {defect.status}
                    </Badge>
                  </div>
                  <p className="text-slate-900 font-medium">{defect.defect_description}</p>
                  {defect.rectification_notes && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-sm text-slate-500">Rectification notes:</p>
                      <p className="text-slate-700">{defect.rectification_notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
              <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
              <p className="text-slate-500">No defects reported</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}