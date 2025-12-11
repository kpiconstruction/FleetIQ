import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const FUNCTION_CLASS_COLORS = {
  CorporateCar: "#6366f1",
  TrafficUte: "#10b981",
  VMSUte: "#f59e0b",
  PodTruckCar: "#8b5cf6",
  PodTruckTruck: "#ec4899",
  TMA: "#06b6d4",
};

const FUNCTION_CLASS_LABELS = {
  CorporateCar: "Corporate Car",
  TrafficUte: "Traffic Ute",
  VMSUte: "VMS Ute",
  PodTruckCar: "Pod Truck Car",
  PodTruckTruck: "Pod Truck Truck",
  TMA: "TMA",
};

export default function FleetByFunctionChart({ data }) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: FUNCTION_CLASS_LABELS[key] || key,
    value,
    color: FUNCTION_CLASS_COLORS[key] || "#94a3b8",
  }));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">Fleet by Functional Class</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis 
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-slate-600 dark:text-slate-400"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-slate-600 dark:text-slate-400"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}