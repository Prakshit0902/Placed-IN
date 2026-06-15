"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2, ChevronRight, Lock, Target, Calendar, CheckCircle2, Layers, Trash2 } from "lucide-react";
import {
  getFullTemplate,
  getPersonalizedSheet,
  getTemplateProgress,
  getSheetProgress,
  updateProgress,
  deleteSheet,
} from "@/lib/api";
import { QuestionRow } from "@/components/QuestionRow";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";

export default function SheetViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();

  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const sheetId = params.sheet_id as string;
  const sheetType = searchParams.get("type");
  const isPersonalized = sheetType === "personalized" || sheetType === "deep";

  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<any>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({ 1: true });

  const containerRef = useRef<HTMLDivElement>(null);
  const progressPercentRef = useRef<HTMLSpanElement>(null);

  // Fetch full sheet template & progress metrics
  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        let data, progress = [];

        if (isPersonalized) {
          if (!token) throw new Error("Authentication required for personalized sheets");
          const res = await getPersonalizedSheet(sheetId, token);
          if (res.success) data = res.data;
          
          const progRes = await getSheetProgress(sheetId, token);
          if (progRes.success) progress = progRes.data;
        } else {
          const res = await getFullTemplate(sheetId, token || "");
          if (res.success) data = res.data;

          if (token) {
            const progRes = await getTemplateProgress(sheetId, token);
            if (progRes.success) {
              progress = progRes.data;
              if (progress.length === 0 && data) {
                const firstWeek = (data.template_data || data.personalized_data)?.weeks?.[0];
                const firstQuestion = firstWeek?.questions?.[0];
                if (firstQuestion) {
                  try {
                    await updateProgress(token, {
                      template_id: sheetId,
                      week_number: firstWeek.week ?? firstWeek.week_number ?? 1,
                      question_id: firstQuestion.id,
                      status: "not_started",
                    });
                    progress = [{
                      question_id: firstQuestion.id,
                      status: "not_started",
                    }];
                  } catch (e) {
                    console.error("Failed to auto-initialize template progress:", e);
                  }
                }
              }
            }
          }
        }

        if (data) {
          const progressMap = new Map();
          progress.forEach((p: any) => progressMap.set(p.question_id, p.status));

          const weeksData = (data.template_data || data.personalized_data)?.weeks || [];
          const mergedWeeks = weeksData.map((week: any) => ({
            ...week,
            week: week.week ?? week.week_number,
            week_number: week.week_number ?? week.week,
            questions: (week.questions || []).map((q: any) => ({
              ...q,
              lc_status: q.status,
              status: progressMap.get(q.id) || "not_started",
            })),
          }));

          const totalWeeks = data.total_weeks ?? mergedWeeks.length;
          const totalQuestions =
            data.total_questions ??
            mergedWeeks.reduce((n: number, w: { questions?: unknown[] }) => n + (w.questions?.length || 0), 0);

          setSheet({
            ...data,
            weeks: mergedWeeks,
            total_weeks: totalWeeks,
            total_questions: totalQuestions,
            readiness_score: data.readiness_score,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sheetId, isPersonalized, getToken]);

  const toggleWeek = (weekNum: number) => {
    setExpandedWeeks((prev) => ({ ...prev, [weekNum]: !prev[weekNum] }));
  };

  const deleteThisSheet = async () => {
    setIsDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await deleteSheet(sheetId, token);
      if (res.success) {
        router.push('/dashboard');
      } else {
        alert(res.message || "Failed to delete sheet.");
      }
    } catch (err: any) {
      console.error("Error deleting sheet:", err);
      alert(err.message || "An error occurred while deleting the sheet.");
    } finally {
      setIsDeleting(false);
    }
  };
  // Compute solves progress details
  const getOverallProgress = () => {
    if (!sheet || !sheet.weeks) return { completed: 0, total: 0, percent: 0 };
    let completed = 0;
    let total = 0;
    sheet.weeks.forEach((w: any) => {
      w.questions.forEach((q: any) => {
        total++;
        if (q.status === "completed") completed++;
      });
    });
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { completed, total, percent };
  };

  const { completed, total, percent } = getOverallProgress();

  // GSAP animations
  useGSAP(() => {
    if (loading || !sheet) return;

    // 1. Header fade-down
    gsap.fromTo(
      ".sheet-header-anim",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );

    // 2. Metrics summary cards stagger
    gsap.fromTo(
      ".summary-col-anim",
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power2.out", delay: 0.1 }
    );

    // 3. Week Accordion cards stagger rise
    gsap.fromTo(
      ".week-card-anim",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "expo.out", delay: 0.15 }
    );

    // 4. Progress count-up
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

  if (!sheet || !sheet.weeks) {
    return (
      <div className="text-center py-20 select-none">
        <h2 className="text-xl font-bold mb-2">Sheet not found</h2>
        <p className="text-sm text-muted font-light">The requested study plan could not be loaded.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto space-y-6 text-foreground">
      {/* Target readiness score bar (Personalized only) */}
      {isPersonalized && sheet.readiness_score && (
        <div className="glass-card p-5 border border-border/50 sheet-header-anim text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted" />
              <span className="text-[13px] uppercase tracking-widest font-medium text-muted">
                {sheet.company} Readiness Index
              </span>
            </div>
            {sheet.readiness_score.estimated_weeks_to_target > 0 && (
              <span className="text-xs text-muted font-light">
                ~{sheet.readiness_score.estimated_weeks_to_target} weeks to reach 85% target
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(sheet.readiness_score.by_topic || {})
              .slice(0, 8)
              .map(([topic, pct]) => (
                <div key={topic} className="bg-surface/30 p-3 rounded-xl border border-border/30">
                  <div className="flex justify-between items-center text-xs mb-1.5 font-light">
                    <span className="capitalize text-muted truncate pr-2">{topic.replace(/-/g, " ")}</span>
                    <span className="font-semibold font-mono">{pct as number}%</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground transition-all duration-1000"
                      style={{ width: `${Math.min(100, pct as number)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-border/50 relative overflow-hidden sheet-header-anim text-left">
        <div className="absolute inset-0 grid-bg opacity-[0.01] pointer-events-none" />
        {isPersonalized && (
          <div className="absolute top-0 right-0 bg-foreground text-background text-[9px] font-bold px-3 py-1 rounded-bl-lg tracking-widest uppercase font-mono select-none">
            AI Personalized
          </div>
        )}
        
        <div className="space-y-2 relative z-10">
          <h1 className="text-2xl font-bold tracking-tight">
            {sheet.company} · {sheet.role}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-light select-none">
            <span className="bg-surface-elevated/60 px-2.5 py-1 rounded-md border border-border">
              {sheet.duration_days} Days Plan
            </span>
            <span>{sheet.total_weeks} Weeks</span>
            <span>{sheet.total_questions} Questions</span>
          </div>
        </div>
        
        {!isSignedIn && (
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center gap-3 relative z-10">
            <Lock className="h-5 w-5 text-primary-light shrink-0" />
            <p className="text-xs text-muted font-light leading-relaxed">
              Sign in to track study progress and unlock personalized recommendation updates.
            </p>
          </div>
        )}
        
        {isSignedIn && isPersonalized && (
          <div className="relative z-10 shrink-0 flex items-center gap-3">
            {showConfirm ? (
              <div className="flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
                <button
                  onClick={deleteThisSheet}
                  disabled={isDeleting}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Confirm Delete
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isDeleting}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-surface border border-border hover:bg-surface-elevated transition-all disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-95 duration-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Plan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Completed count */}
        <div className="glass-card p-5 border border-border/50 hover-glow transition-all duration-300 summary-col-anim flex items-center justify-between text-left group">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted block mb-1">
              Solved Progress
            </span>
            <span className="text-2xl font-bold font-mono leading-none">
              {completed} <span className="text-muted text-sm font-light">/ {total}</span>
            </span>
          </div>
          <div className="p-3 bg-foreground/5 text-foreground border border-border rounded-xl transition-transform group-hover:scale-110">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Readiness % */}
        <div className="glass-card p-5 border border-border/50 hover-glow transition-all duration-300 summary-col-anim flex items-center justify-between text-left group">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted block mb-1">
              Readiness Ratio
            </span>
            <span ref={progressPercentRef} className="text-2xl font-bold font-mono leading-none">
              0%
            </span>
          </div>
          <div className="p-3 bg-foreground/5 text-foreground border border-border rounded-xl transition-transform group-hover:scale-110">
            <Target className="h-5 w-5" />
          </div>
        </div>

        {/* Duration */}
        <div className="glass-card p-5 border border-border/50 hover-glow transition-all duration-300 summary-col-anim flex items-center justify-between text-left group">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-muted block mb-1">
              Active Weeks
            </span>
            <span className="text-2xl font-bold font-mono leading-none">
              {sheet.total_weeks} <span className="text-muted text-sm font-light">Weeks</span>
            </span>
          </div>
          <div className="p-3 bg-foreground/5 text-foreground border border-border rounded-xl transition-transform group-hover:scale-110">
            <Layers className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Week Accordions */}
      <div className="space-y-4">
        <div className="text-left border-b border-border/30 pb-2 select-none">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
            Weekly Schedule
          </span>
        </div>

        <div className="space-y-4">
          {sheet.weeks.map((week: any) => {
            const isExpanded = expandedWeeks[week.week];
            const completedCount = week.questions.filter((q: any) => q.status === "completed").length;
            const totalCount = week.questions.length;
            const weekPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
            
            return (
              <div
                key={week.week}
                className="glass-card border border-border/50 overflow-hidden transition-all duration-300 week-card-anim"
              >
                <button 
                  onClick={() => toggleWeek(week.week)}
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
                        Week {week.week}: {week.theme}
                      </h3>
                      <p className="text-xs text-muted font-light mt-1 select-none">
                        {week.estimated_hours} hours · {completedCount}/{totalCount} solved
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress bar info */}
                  <div className="hidden md:flex flex-col items-end gap-1.5 w-32 shrink-0 select-none">
                    <span className="text-xs font-semibold font-mono text-muted">{weekPercent}%</span>
                    <div className="w-full h-1 bg-border/40 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-foreground transition-all duration-500" 
                        style={{ width: `${weekPercent}%` }}
                      />
                    </div>
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="border-t border-border/40 bg-surface/10 divide-y divide-border/20">
                    {week.questions.length > 0 ? (
                      week.questions.map((question: any) => (
                        <QuestionRow 
                          key={question.id} 
                          question={question} 
                          weekNumber={week.week}
                          sheetId={sheetId}
                          isPersonalized={isPersonalized}
                        />
                      ))
                    ) : (
                      <div className="p-6 text-center text-muted text-xs font-light select-none">
                        No questions assigned for this week.
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
