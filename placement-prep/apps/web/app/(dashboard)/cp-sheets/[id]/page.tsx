"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2, ChevronRight, CheckCircle2, Layers, Calendar, ExternalLink } from "lucide-react";
import { getCpSheet, updateCpProgress } from "@/lib/api";
import { CpQuestionRow } from "@/components/CpQuestionRow";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";
import Link from "next/link";

export default function CpSheetViewerPage() {
  const params = useParams();
  const { getToken } = useAuth();
  
  const sheetId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<any>(null);
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });

  const containerRef = useRef<HTMLDivElement>(null);
  const progressPercentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await getCpSheet(sheetId, token);
        if (res.success) {
          setSheet(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sheetId, getToken]);

  const toggleDay = (dayNum: number) => {
    setExpandedDays((prev) => ({ ...prev, [dayNum]: !prev[dayNum] }));
  };

  // We handle state optimistically inside CpQuestionRow now, so we can pass down sheetId and it handles the update logic.
  // We just need to let the row render, but we still need overall completion tracking.
  // Wait, CpQuestionRow updates the API but we want to update the local state to recalculate completion.
  // Actually, I can pass a callback to CpQuestionRow or just let it be. If we want local percent to update instantly:
  const handleStatusChange = (dayNum: number, problem: any, newStatus: string) => {
    setSheet((prev: any) => {
      const newData = prev.sheet_data.map((d: any) => {
        if (d.day_number === dayNum) {
          return {
            ...d,
            problems: d.problems.map((p: any) => {
              if (p.problem_id === problem.problem_id && p.platform === problem.platform) {
                return { ...p, status: newStatus };
              }
              return p;
            })
          };
        }
        return d;
      });
      return { ...prev, sheet_data: newData };
    });
  };

  // Compute solves progress details
  const getOverallProgress = () => {
    if (!sheet || !sheet.sheet_data) return { completed: 0, total: 0, percent: 0 };
    let completed = 0;
    let total = 0;
    sheet.sheet_data.forEach((d: any) => {
      d.problems.forEach((q: any) => {
        total++;
        if (q.status === "completed") completed++;
      });
    });
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { completed, total, percent };
  };

  const { completed, total, percent } = getOverallProgress();

  useGSAP(() => {
    if (loading || !sheet) return;

    gsap.fromTo(
      ".sheet-header-anim",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );

    gsap.fromTo(
      ".summary-col-anim",
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power2.out", delay: 0.1 }
    );

    gsap.fromTo(
      ".day-card-anim",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "expo.out", delay: 0.15 }
    );

    if (progressPercentRef.current) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: percent,
        duration: 1.2,
        ease: "expo.out",
        onUpdate: () => {
          if (progressPercentRef.current) progressPercentRef.current.textContent = `${Math.floor(obj.val)}%`;
        },
      });
    }

  }, { scope: containerRef, dependencies: [loading, sheet] });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-light" />
      </div>
    );
  }

  if (!sheet || !sheet.sheet_data) {
    return (
      <div className="text-center py-20 select-none">
        <h2 className="text-xl font-bold mb-2">Sheet not found</h2>
        <p className="text-sm text-muted font-light">The requested CP plan could not be loaded.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto space-y-6 text-foreground">
      {/* Header Panel */}
      <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-border/50 relative overflow-hidden sheet-header-anim text-left">
        <div className="absolute inset-0 grid-bg opacity-[0.01] pointer-events-none" />
        <div className="absolute top-0 right-0 bg-primary/20 text-primary-light text-[9px] font-bold px-3 py-1 rounded-bl-lg tracking-widest uppercase font-mono select-none">
          Custom CP Plan
        </div>
        
        <div className="space-y-2 relative z-10">
          <h1 className="text-2xl font-bold tracking-tight">
            {sheet.sheet_name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-light select-none">
            <span className="bg-surface-elevated/60 px-2.5 py-1 rounded-md border border-border capitalize">
              {sheet.target_level} Level
            </span>
            <span>{sheet.duration_days} Days Plan</span>
            <span>{total} Problems</span>
          </div>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-card p-5 border border-border/50 hover-glow transition-all duration-300 summary-col-anim flex items-center justify-between text-left group">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted block mb-1">
              Solved Progress
            </span>
            <span className="text-2xl font-bold font-mono leading-none">
              {completed} <span className="text-muted text-sm font-light">/ {total}</span>
            </span>
          </div>
          <div className="p-3 bg-success/10 text-success border border-success/20 rounded-xl transition-transform group-hover:scale-110">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card p-5 border border-border/50 hover-glow transition-all duration-300 summary-col-anim flex items-center justify-between text-left group">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted block mb-1">
              Completion Rate
            </span>
            <span ref={progressPercentRef} className="text-2xl font-bold font-mono leading-none">
              0%
            </span>
          </div>
          <div className="p-3 bg-primary/10 text-primary-light border border-primary/20 rounded-xl transition-transform group-hover:scale-110">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div className="glass-card p-5 border border-border/50 hover-glow transition-all duration-300 summary-col-anim flex items-center justify-between text-left group">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted block mb-1">
              Active Days
            </span>
            <span className="text-2xl font-bold font-mono leading-none">
              {sheet.duration_days} <span className="text-muted text-sm font-light">Days</span>
            </span>
          </div>
          <div className="p-3 bg-foreground/5 text-foreground border border-border rounded-xl transition-transform group-hover:scale-110">
            <Layers className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Day Accordions */}
      <div className="space-y-4">
        <div className="text-left border-b border-border/30 pb-2 select-none">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
            Daily Schedule
          </span>
        </div>

        <div className="space-y-4">
          {sheet.sheet_data.map((day: any) => {
            const isExpanded = expandedDays[day.day_number];
            const completedCount = day.problems.filter((q: any) => q.status === "completed").length;
            const totalCount = day.problems.length;
            const dayPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
            
            return (
              <div
                key={day.day_number}
                className="glass-card border border-border/50 overflow-hidden transition-all duration-300 day-card-anim"
              >
                <button 
                  onClick={() => toggleDay(day.day_number)}
                  className="w-full flex items-center justify-between p-5 hover:bg-surface-elevated/40 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={clsx(
                      "p-2 rounded-lg transition-transform duration-300 shrink-0",
                      isExpanded ? "rotate-90 bg-foreground/5 border border-border text-foreground" : "bg-surface border border-border text-muted"
                    )}>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[15px] text-foreground truncate">
                        Day {day.day_number}
                      </h3>
                      <p className="text-xs text-muted font-light mt-1 select-none">
                        {completedCount}/{totalCount} solved
                      </p>
                    </div>
                  </div>
                  
                  <div className="hidden md:flex flex-col items-end gap-1.5 w-32 shrink-0 select-none">
                    <span className="text-xs font-semibold font-mono text-muted">{dayPercent}%</span>
                    <div className="w-full h-1 bg-border/40 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-foreground transition-all duration-500" 
                        style={{ width: `${dayPercent}%` }}
                      />
                    </div>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="border-t border-border/40 bg-surface/10 divide-y divide-border/20">
                    {day.problems.length > 0 ? (
                      day.problems.map((problem: any, idx: number) => (
                        <div key={idx}>
                           <CpQuestionRow 
                             problem={problem}
                             dayNumber={day.day_number}
                             sheetId={sheetId}
                             onStatusChange={(newStatus) => {
                               handleStatusChange(day.day_number, problem, newStatus);
                             }}
                           />
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-muted text-xs font-light select-none">
                        No problems assigned for this day.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
