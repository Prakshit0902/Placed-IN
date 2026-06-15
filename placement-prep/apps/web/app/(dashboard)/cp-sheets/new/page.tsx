"use client";

import { useState, FormEvent, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CalendarDays,
  Target,
  Trophy,
  ArrowRight,
  Code2,
  Gamepad2,
  BookOpen
} from "lucide-react";
import { generateCpSheet } from "@/lib/api";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";

const TOPICS = [
  "Arrays", "Strings", "Math", "Linked List", "Stack", "Queue",
  "Trees", "Graphs", "Heaps", "Dynamic Programming", "Greedy",
  "Backtracking", "Bit Manipulation"
];

export default function NewCpSheetPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [duration, setDuration] = useState("30");
  const [targetLevel, setTargetLevel] = useState<"beginner" | "expert" | "cp">("beginner");
  const [platforms, setPlatforms] = useState<string[]>(["leetcode", "codeforces"]);
  const [lcDifficulties, setLcDifficulties] = useState<string[]>(["Easy", "Medium"]);
  const [cfRatingMin, setCfRatingMin] = useState(800);
  const [cfRatingMax, setCfRatingMax] = useState(1200);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["Arrays", "Strings"]);

  const containerRef = useRef<HTMLDivElement>(null);

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const toggleLcDifficulty = (d: string) => {
    setLcDifficulties(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const toggleTopic = (t: string) => {
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!sheetName || platforms.length === 0 || selectedTopics.length === 0) {
      alert("Please fill all required fields, select at least one platform and topic.");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await generateCpSheet(token, {
        sheet_name: sheetName,
        sheet_type: "custom_cp",
        target_level: targetLevel,
        selected_topics: selectedTopics.map(t => t.toLowerCase().replace(" ", "-")),
        platforms,
        duration_days: parseInt(duration),
        lc_difficulties: platforms.includes("leetcode") ? lcDifficulties : [],
        cf_rating_min: cfRatingMin,
        cf_rating_max: cfRatingMax,
      });

      if (res.success && res.data) {
        router.push(`/cp-sheets/${res.data.id}`);
      } else {
        alert(res.message || "Failed to generate CP sheet.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error generating sheet.");
    } finally {
      setLoading(false);
    }
  };

  useGSAP(() => {
    gsap.fromTo(
      ".form-step-anim",
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power2.out" }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto space-y-6 text-foreground">
      {/* Header */}
      <div className="dashboard-header border-b border-border/40 pb-6 text-left">
        <h1 className="text-2xl font-bold tracking-tight">Create Custom CP Sheet</h1>
        <p className="text-sm text-muted font-light mt-1">
          Combine problems from LeetCode and Codeforces based on your current level and target skills.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Sheet Details */}
          <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-border/30 pb-2">
              <BookOpen className="h-4 w-4 text-muted" />
              <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                1. Sheet Details
              </h3>
            </div>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              required
              className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all text-foreground placeholder:text-muted/50"
              placeholder="e.g. Dynamic Programming Masterclass"
            />
          </div>

          {/* Target Level */}
          <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-border/30 pb-2">
              <Target className="h-4 w-4 text-muted" />
              <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                2. Target Level & Intensity
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => setTargetLevel("beginner")}
                className={clsx(
                  "cursor-pointer rounded-xl border p-4 transition-all flex flex-col items-center justify-center text-center",
                  targetLevel === "beginner" ? "border-foreground bg-surface-elevated text-foreground" : "border-border/50 text-muted"
                )}
              >
                <span className="font-semibold text-sm">Beginner</span>
                <span className="text-[10px] mt-1 opacity-80">3 probs/day</span>
              </div>
              <div
                onClick={() => setTargetLevel("expert")}
                className={clsx(
                  "cursor-pointer rounded-xl border p-4 transition-all flex flex-col items-center justify-center text-center",
                  targetLevel === "expert" ? "border-foreground bg-surface-elevated text-foreground" : "border-border/50 text-muted"
                )}
              >
                <span className="font-semibold text-sm">Expert</span>
                <span className="text-[10px] mt-1 opacity-80">5 probs/day</span>
              </div>
              <div
                onClick={() => setTargetLevel("cp")}
                className={clsx(
                  "cursor-pointer rounded-xl border p-4 transition-all flex flex-col items-center justify-center text-center",
                  targetLevel === "cp" ? "border-foreground bg-surface-elevated text-foreground" : "border-border/50 text-muted"
                )}
              >
                <span className="font-semibold text-sm">Competitive</span>
                <span className="text-[10px] mt-1 opacity-80">6+ probs/day</span>
              </div>
            </div>
          </div>

          {/* Platforms & Difficulties */}
          <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-border/30 pb-2">
              <Gamepad2 className="h-4 w-4 text-muted" />
              <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                3. Platforms & Difficulty
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={platforms.includes("leetcode")} onChange={() => togglePlatform("leetcode")} className="rounded text-primary focus:ring-primary" />
                  <span className="text-sm font-semibold">LeetCode</span>
                </label>
                {platforms.includes("leetcode") && (
                  <div className="pl-6 flex gap-2 flex-wrap">
                    {["Easy", "Medium", "Hard"].map(d => (
                      <span
                        key={d}
                        onClick={() => toggleLcDifficulty(d)}
                        className={clsx(
                          "text-[11px] px-3 py-1 rounded-full cursor-pointer transition-colors border",
                          lcDifficulties.includes(d) ? "bg-foreground text-background border-foreground" : "bg-surface border-border text-muted"
                        )}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={platforms.includes("codeforces")} onChange={() => togglePlatform("codeforces")} className="rounded text-primary focus:ring-primary" />
                  <span className="text-sm font-semibold">Codeforces</span>
                </label>
                {platforms.includes("codeforces") && (
                  <div className="pl-6 space-y-2">
                    <div className="flex justify-between text-[11px] text-muted">
                      <span>Min Rating: {cfRatingMin}</span>
                      <span>Max Rating: {cfRatingMax}</span>
                    </div>
                    <div className="flex gap-4">
                      <input type="range" min="800" max="3500" step="100" value={cfRatingMin} onChange={e => setCfRatingMin(parseInt(e.target.value))} className="w-full" />
                      <input type="range" min="800" max="3500" step="100" value={cfRatingMax} onChange={e => setCfRatingMax(parseInt(e.target.value))} className="w-full" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-border/30 pb-2">
              <Code2 className="h-4 w-4 text-muted" />
              <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                4. Select Topics
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map(t => (
                <span
                  key={t}
                  onClick={() => toggleTopic(t)}
                  className={clsx(
                    "text-xs px-3 py-1.5 rounded-xl cursor-pointer transition-colors border",
                    selectedTopics.includes(t) ? "bg-primary/20 text-primary-light border-primary/30 font-semibold" : "bg-surface border-border/50 text-muted hover:border-border"
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Duration */}
          <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-border/30 pb-2">
              <CalendarDays className="h-4 w-4 text-muted" />
              <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                Duration
              </h3>
            </div>
            <div className="flex flex-col gap-3">
              {[15, 30, 45, 60].map((days) => (
                <div
                  key={days}
                  onClick={() => setDuration(days.toString())}
                  className={clsx(
                    "cursor-pointer rounded-xl border p-4 transition-all text-center flex items-center justify-between",
                    duration === days.toString() ? "border-foreground bg-surface-elevated text-foreground" : "border-border/50 text-muted"
                  )}
                >
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono">{days}</span>
                    <span className="text-xs">days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="form-step-anim">
            <button
              type="submit"
              disabled={loading || !sheetName || platforms.length === 0}
              className="w-full py-4 bg-foreground text-background text-sm font-semibold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <>Generate CP Sheet <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
