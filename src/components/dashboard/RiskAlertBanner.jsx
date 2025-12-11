import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function RiskAlertBanner({ riskStatuses, onDismiss }) {
  const redWorkers = riskStatuses.filter(s => s.current_risk_level === 'Red');
  
  if (redWorkers.length === 0) return null;

  const newRedWorkers = redWorkers.filter(s => {
    const daysSince = (Date.now() - new Date(s.first_detected_datetime).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7; // Show for workers flagged in last 7 days
  });

  const longTermRed = redWorkers.filter(s => {
    const daysSince = (Date.now() - new Date(s.first_detected_datetime).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 30;
  });

  if (newRedWorkers.length === 0 && longTermRed.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {/* New Red Alerts */}
      {newRedWorkers.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-500 dark:border-rose-700 rounded-2xl p-4 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-rose-500 dark:bg-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-rose-900 dark:text-rose-200 mb-1">
                    🚨 High-Risk Worker Alert
                  </h3>
                  <p className="text-sm text-rose-700 dark:text-rose-300 mb-3">
                    {newRedWorkers.length} worker{newRedWorkers.length > 1 ? 's have' : ' has'} been flagged as HIGH-RISK. Immediate action required.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {newRedWorkers.slice(0, 5).map((worker, idx) => (
                      <Link 
                        key={idx}
                        to={createPageUrl(`WorkerRiskProfile?worker=${encodeURIComponent(worker.worker_name)}`)}
                      >
                        <Badge className="bg-rose-600 hover:bg-rose-700 text-white border-0 cursor-pointer">
                          {worker.worker_name}
                          {worker.hvnl_incidents_12m > 0 && ' (HVNL)'}
                        </Badge>
                      </Link>
                    ))}
                    {newRedWorkers.length > 5 && (
                      <Badge variant="outline" className="bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700">
                        +{newRedWorkers.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
                {onDismiss && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onDismiss('new')}
                    className="text-rose-600 hover:text-rose-800 dark:text-rose-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 30+ Day Escalation */}
      {longTermRed.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-600 dark:border-red-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-red-600 dark:bg-red-700 flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-red-900 dark:text-red-200 mb-1">
                    ⚠️ ESCALATION: Workers at Red Risk for 30+ Days
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                    {longTermRed.length} worker{longTermRed.length > 1 ? 's remain' : ' remains'} at HIGH-RISK status. Executive action required.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {longTermRed.map((worker, idx) => {
                      const daysSince = Math.floor((Date.now() - new Date(worker.first_detected_datetime).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <Link 
                          key={idx}
                          to={createPageUrl(`WorkerRiskProfile?worker=${encodeURIComponent(worker.worker_name)}`)}
                        >
                          <Badge className="bg-red-700 hover:bg-red-800 text-white border-0 cursor-pointer font-semibold">
                            {worker.worker_name} ({daysSince} days)
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                {onDismiss && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onDismiss('escalation')}
                    className="text-red-600 hover:text-red-800 dark:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}