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
    { name: "Completed", value: completed, color: "var(--foreground)" },
    { name: "Remaining", value: remaining > 0 ? remaining : 0, color: "var(--border)" },
  ];

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center relative border border-border/50 hover-glow transition-all duration-300">
      <h3 className="font-semibold text-xs uppercase tracking-widest text-muted absolute top-4 left-4">
        {title}
      </h3>
      <div className="h-40 w-40 mt-6 relative select-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={65}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              cornerRadius={4}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: "12px",
                backdropFilter: "blur(12px)",
              }}
              itemStyle={{ color: "var(--foreground)", fontSize: "11px", fontFamily: "var(--font-geist-mono)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold font-mono leading-none mb-1">{percentage}%</span>
          <span className="text-[10px] text-muted font-mono leading-none">{completed}/{total}</span>
        </div>
      </div>
    </div>
  );
}
