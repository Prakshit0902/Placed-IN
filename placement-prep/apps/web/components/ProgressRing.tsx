"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ProgressRingProps {
  completed: number;
  total: number;
  title: string;
}

export function ProgressRing({ completed, total, title }: ProgressRingProps) {
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  const remaining = total - completed;

  const data = [
    { name: "Completed", value: completed, color: "#6366f1" },
    { name: "Remaining", value: remaining > 0 ? remaining : 0, color: "rgba(30, 41, 59, 0.5)" }, // subtle border color
  ];

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center relative">
      <h3 className="font-semibold text-sm mb-4 absolute top-4 left-4">{title}</h3>
      <div className="h-40 w-40 mt-6 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={70}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              cornerRadius={8}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
              itemStyle={{ color: "#e8ecf4" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold">{percentage}%</span>
          <span className="text-xs text-muted">{completed}/{total}</span>
        </div>
      </div>
    </div>
  );
}
