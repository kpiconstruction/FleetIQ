import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProblemAssetsTable({ vehicles }) {
  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Problem Assets</h3>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">No problem assets at this time</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Top Problem Assets</h3>
      </div>
      <div className="space-y-3">
        {vehicles.slice(0, 10).map((vehicle) => (
          <Link
            key={vehicle.id}
            to={createPageUrl(`VehicleDetail?id=${vehicle.id}`)}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{vehicle.asset_type?.charAt(0)}</span>
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{vehicle.asset_code}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{vehicle.rego}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                {vehicle.issue_count || 0} issues
              </Badge>
              <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}