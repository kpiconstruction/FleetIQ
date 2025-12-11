import React from "react";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function StandDownSummary({ downtimeEvents }) {
  const expected = downtimeEvents?.filter(e => e.stand_down_expected).length || 0;
  const confirmed = downtimeEvents?.filter(e => e.stand_down_confirmed).length || 0;
  const pending = expected - confirmed;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5 text-violet-500" />
        <h3 className="text-lg font-semibold text-slate-900">Stand-Down Status</h3>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-violet-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-medium text-violet-900">Expected</span>
          </div>
          <span className="text-2xl font-bold text-violet-600">{expected}</span>
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-900">Confirmed</span>
          </div>
          <span className="text-2xl font-bold text-emerald-600">{confirmed}</span>
        </div>
        
        {pending > 0 && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">Pending Confirmation</span>
            </div>
            <span className="text-2xl font-bold text-amber-600">{pending}</span>
          </div>
        )}
      </div>
    </div>
  );
}