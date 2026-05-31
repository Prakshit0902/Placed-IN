"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { getFullTemplate, getPersonalizedSheet, getTemplateProgress, getSheetProgress, updateProgress } from "@/lib/api";
import { QuestionRow } from "@/components/QuestionRow";

export default function SheetViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { getToken, isSignedIn } = useAuth();
  
  const sheetId = params.sheet_id as string;
  const sheetType = searchParams.get("type");
  const isPersonalized = sheetType === "personalized" || sheetType === "deep";

  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<any>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({ 1: true }); // Week 1 open by default

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        // If it's a generic template, token is optional (but passed if signed in to get progress)
        let data, progress = [];

        if (isPersonalized) {
          if (!token) throw new Error("Authentication required for personalized sheets");
          const res = await getPersonalizedSheet(sheetId, token);
          if (res.success) data = res.data;
          
          const progRes = await getSheetProgress(sheetId, token);
          if (progRes.success) progress = progRes.data;
        } else {
          // Standard template
          const res = await getFullTemplate(sheetId, token || "");
          if (res.success) data = res.data;

          if (token) {
            const progRes = await getTemplateProgress(sheetId, token);
            if (progRes.success) {
              progress = progRes.data;
              // Auto-initialize standard template progress for the user if it's their first time opening it
              if (progress.length === 0 && data) {
                const firstWeek = (data.template_data || data.personalized_data)?.weeks?.[0];
                const firstQuestion = firstWeek?.questions?.[0];
                if (firstQuestion) {
                  try {
                    await updateProgress(token, {
                      template_id: sheetId,
                      week_number: firstWeek.week ?? firstWeek.week_number ?? 1,
                      question_id: firstQuestion.id,
                      status: "not_started"
                    });
                    progress = [{
                      question_id: firstQuestion.id,
                      status: "not_started"
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
          // Merge progress into template data
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
              status: progressMap.get(q.id) || "not_started"
            }))
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
    setExpandedWeeks(prev => ({ ...prev, [weekNum]: !prev[weekNum] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sheet || !sheet.weeks) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Sheet not found</h2>
        <p className="text-muted">The requested study plan could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {isPersonalized && sheet.readiness_score && (
        <div className="glass-card p-6 border border-border/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted mb-1">{sheet.company} readiness</p>
              <p className="text-4xl font-bold text-primary-light">
                {sheet.readiness_score.overall}%
              </p>
              {sheet.readiness_score.estimated_weeks_to_target > 0 && (
                <p className="text-sm text-muted mt-1">
                  ~{sheet.readiness_score.estimated_weeks_to_target} weeks to reach 85% target
                </p>
              )}
            </div>
          </div>
          {sheet.readiness_score.by_topic && Object.keys(sheet.readiness_score.by_topic).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(sheet.readiness_score.by_topic)
                .sort(([, a], [, b]) => (a as number) - (b as number))
                .slice(0, 8)
                .map(([topic, pct]) => (
                  <div key={topic}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize text-muted">{topic.replace(/-/g, " ")}</span>
                      <span className="font-medium">{pct as number}%</span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, pct as number)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-border/50 relative overflow-hidden">
        {isPersonalized && (
          <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
            AI PERSONALIZED
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {sheet.company} · {sheet.role}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="bg-surface-elevated px-2.5 py-1 rounded-md border border-border">{sheet.duration_days} Days Plan</span>
            <span>{sheet.total_weeks} Weeks</span>
            <span>{sheet.total_questions} Questions</span>
          </div>
        </div>
        
        {!isSignedIn && (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center gap-3">
            <Lock className="h-5 w-5 text-primary-light flex-shrink-0" />
            <p className="text-sm text-primary-light font-medium">
              Sign in to track your progress and generate personalized plans.
            </p>
          </div>
        )}
      </div>

      {/* Weeks Accordion */}
      <div className="space-y-4 stagger-children">
        {sheet.weeks.map((week: any) => {
          const isExpanded = expandedWeeks[week.week];
          const completedCount = week.questions.filter((q: any) => q.status === "completed").length;
          const totalCount = week.questions.length;
          
          return (
            <div key={week.week} className="glass-card border border-border/50 overflow-hidden transition-all duration-300">
              <button 
                onClick={() => toggleWeek(week.week)}
                className="w-full flex items-center justify-between p-5 hover:bg-surface-elevated transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg transition-transform duration-300 ${isExpanded ? 'rotate-90 bg-primary/10 text-primary-light' : 'bg-surface border border-border text-muted'}`}>
                    <ChevronRight className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">Week {week.week}: {week.theme}</h3>
                    <p className="text-sm text-muted mt-0.5">
                      {week.estimated_hours} hours · {completedCount}/{totalCount} completed
                    </p>
                  </div>
                </div>
                
                {/* Progress bar miniature */}
                <div className="hidden md:flex flex-col items-end gap-1.5 w-32">
                  <span className="text-xs font-medium text-muted">{Math.round((completedCount/totalCount)*100)}%</span>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${(completedCount/totalCount)*100}%` }}
                    />
                  </div>
                </div>
              </button>
              
              {isExpanded && (
                <div className="border-t border-border/50 bg-surface/30">
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
                    <div className="p-6 text-center text-muted text-sm">No questions assigned for this week.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
