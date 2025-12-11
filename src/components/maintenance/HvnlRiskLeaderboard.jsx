import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { AlertTriangle, Shield, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function HvnlRiskLeaderboard({ limit = 10 }) {
  const { data: riskData, isLoading } = useQuery({
    queryKey: ["hvnlRiskScores"],
    queryFn: async () => {
      const response = await base44.functions.invoke("calculateHvnlRiskScores", {});
      return response.data;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const getRiskBadge = (riskLevel, riskScore) => {
    const styles = {
      High: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400",
      Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400",
      Low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400",
    };

    const icons = {
      High: <AlertTriangle className="w-3 h-3 mr-1" />,
      Medium: <TrendingUp className="w-3 h-3 mr-1" />,
      Low: <Shield className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge variant="outline" className={`${styles[riskLevel]} font-semibold`}>
        {icons[riskLevel]}
        {riskLevel} ({riskScore})
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!riskData?.risk_scores || riskData.risk_scores.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-100 dark:border-slate-700">
        <Shield className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400">No HVNL-critical assets found</p>
      </div>
    );
  }

  const topRiskAssets = riskData.risk_scores.slice(0, limit);
  const highRiskCount = riskData.high_risk_count || 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              HVNL Risk Leaderboard
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Ranked by safety and compliance risk
            </p>
          </div>
          {highRiskCount > 0 && (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50">
              {highRiskCount} High Risk
            </Badge>
          )}
        </div>
      </div>

      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-900/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Asset Code</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Risk Score</TableHead>
              <TableHead>HVNL Overdue</TableHead>
              <TableHead>Open Defects</TableHead>
              <TableHead>Days Overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topRiskAssets.map((asset, index) => {
              const isHighRisk = asset.risk_level === 'High';
              return (
                <TableRow
                  key={asset.vehicle_id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 ${
                    isHighRisk ? "bg-rose-50/30 dark:bg-rose-900/10" : ""
                  }`}
                >
                  <TableCell className="font-semibold text-slate-400">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      to={createPageUrl(`VehicleDetail?id=${asset.vehicle_id}`)}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {asset.asset_code}
                    </Link>
                    <p className="text-xs text-slate-500">{asset.rego}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800">
                      {asset.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{asset.vehicle_function_class}</TableCell>
                  <TableCell>{getRiskBadge(asset.risk_level, asset.risk_score)}</TableCell>
                  <TableCell>
                    {asset.hvnl_overdue_count > 0 ? (
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50">
                        {asset.hvnl_overdue_count}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {asset.open_critical_defects > 0 ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50">
                        {asset.open_critical_defects}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {asset.max_days_overdue > 0 ? (
                      <span className="text-rose-600 font-semibold">
                        {asset.max_days_overdue}d
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {riskData.risk_scores.length > limit && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing top {limit} of {riskData.risk_scores.length} HVNL-critical assets
          </p>
        </div>
      )}
    </div>
  );
}