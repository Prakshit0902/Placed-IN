"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Flame,
  Layers,
  Target,
  Sparkles,
  Search,
  Bell,
  CalendarDays,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { getStreak, getMySheets, getMe } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ─── HEATMAP DATA GENERATOR (deterministic last 182 days / 6 months) ───
const generateHeatmapData = (totalSolved: number) => {
  const data = [];
  const today = new Date("2026-06-08"); // Static anchor matching context date
  for (let i = 181; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Seed solves deterministically based on date digits
    const seed = (date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()) % 100;
    let value = 0;
    
    if (totalSolved > 0) {
      if (seed % 7 === 0) value = 0;
      else if (seed % 5 === 0) value = isWeekend ? 1 : 2;
      else if (seed % 3 === 0) value = isWeekend ? 0 : 4;
      else if (seed % 11 === 0) value = 6;
      else value = 1;
    } else {
      value = 0; // Empty profile solves nothing
    }

    data.push({
      date: date.toISOString().split("T")[0],
      value,
    });
  }
  return data;
};

// ─── RECHARTS RADAR TOPIC DATA ───
const topicData = [
  { name: "Arrays", count: 85 },
  { name: "Trees", count: 65 },
  { name: "DP", count: 40 },
  { name: "Graphs", count: 55 },
  { name: "Strings", count: 70 },
  { name: "Sorting", count: 75 },
  { name: "Backtracking", count: 50 },
  { name: "Sliding Window", count: 60 },
];

// ─── MOCK DUE REVIEWS ───
const mockReviews = [
  { title: "Two Sum", difficulty: "easy", due: "Due in 1 day", isWarning: true },
  { title: "LRU Cache", difficulty: "hard", due: "Due in 2 days", isWarning: false },
  { title: "Longest Palindromic Substring", difficulty: "medium", due: "Due in 3 days", isWarning: false },
];

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [sheets, setSheets] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Animation/Loader helpers
  const [mounted, setMounted] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  // GSAP animation refs
  const pageRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const solvedRef = useRef<HTMLSpanElement>(null);
  const sheetsRef = useRef<HTMLSpanElement>(null);
  const readinessRef = useRef<HTMLSpanElement>(null);

  // Magnetic button helper
  const handleMagneticMove = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    el.style.setProperty("--bx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--by", `${e.clientY - rect.top}px`);
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    el.style.transform = "translate(0, 0)";
  };

  // API Call Load Sequence
  useEffect(() => {
    setMounted(true);
    
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const [streakRes, sheetsRes, userRes] = await Promise.all([
          getStreak(token),
          getMySheets(token),
          getMe(token),
        ]);
        setStreak(streakRes.data?.current_streak || 0);
        setTotalCompleted(streakRes.data?.total_completed || 0);
        setSheets(sheetsRes.data || []);
        setUser(userRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  // Pulse skeleton loading state control
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setShowSkeleton(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const heatmapData = generateHeatmapData(totalCompleted);

  // Monochromatic cells background builder using CSS variables
  const getCellBg = (val: number) => {
    if (val === 0) return "var(--surface-elevated)";
    if (val <= 2) return "rgba(var(--foreground-rgb), 0.15)";
    if (val <= 5) return "rgba(var(--foreground-rgb), 0.35)";
    return "rgba(var(--foreground-rgb), 0.70)";
  };

  // ─── INITIALIZE ENTRANCE ANIMATIONS ───
  useGSAP(() => {
    // 1. Header Entrance
    gsap.fromTo(
      ".dashboard-header",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );

    // 2. Section Headings blur-in
    gsap.fromTo(
      ".section-heading-anim",
      { filter: "blur(8px)", y: 10, opacity: 0 },
      { filter: "blur(0px)", y: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: 0.05 }
    );
  }, { scope: pageRef, dependencies: [] });

  // ─── MOUNTED STATS ENTRANCE & COUNT-UP ───
  useGSAP(() => {
    if (showSkeleton || loading) return;

    // 1. Stats Row fade-up stagger
    gsap.fromTo(
      ".stat-card-anim",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "expo.out" }
    );

    // 2. Numeric Count-ups
    if (streakRef.current) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: streak,
        duration: 1.2,
        ease: "expo.out",
        onUpdate: () => {
          if (streakRef.current) streakRef.current.textContent = Math.floor(obj.val).toString();
        },
      });
    }

    if (solvedRef.current) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: totalCompleted,
        duration: 1.2,
        ease: "expo.out",
        onUpdate: () => {
          if (solvedRef.current) solvedRef.current.textContent = Math.floor(obj.val).toString();
        },
      });
    }

    if (sheetsRef.current) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: sheets.length,
        duration: 1.2,
        ease: "expo.out",
        onUpdate: () => {
          if (sheetsRef.current) sheetsRef.current.textContent = Math.floor(obj.val).toString();
        },
      });
    }

    if (readinessRef.current && sheets.length > 0) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: 72,
        duration: 1.2,
        ease: "expo.out",
        onUpdate: () => {
          if (readinessRef.current) readinessRef.current.textContent = `${Math.floor(obj.val)}%`;
        },
      });
    }

    // ─── SCROLL TRIGGER ANIMATIONS ───
    // 3. Heatmap Scroll Reveal
    gsap.fromTo(
      ".heatmap-section",
      { scale: 0.97, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.6,
        scrollTrigger: {
          trigger: ".heatmap-section",
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      }
    );

    // 4. Heatmap Cells fast stagger scale entry
    gsap.fromTo(
      ".heatmap-cell",
      { scale: 0 },
      {
        scale: 1,
        duration: 0.3,
        stagger: 0.003,
        ease: "power1.out",
        scrollTrigger: {
          trigger: ".heatmap-section",
          start: "top 85%",
        },
      }
    );

    // 5. Sheet Cards stagger slide in
    gsap.fromTo(
      ".sheet-card-anim",
      { x: -16, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.06,
        scrollTrigger: {
          trigger: ".sheets-section",
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      }
    );

    // 6. Topic Coverage Chart y-translate reveal
    gsap.fromTo(
      ".chart-section",
      { y: 24, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        scrollTrigger: {
          trigger: ".chart-section",
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
      }
    );
  }, { scope: pageRef, dependencies: [showSkeleton, loading] });

  // ─── SKELETON CARD SENSITIVE LOADER RENDERER ───
  const renderStatSkeleton = () => (
    <div className="glass-card p-5 animate-pulse flex flex-col justify-between h-28 bg-surface-elevated/40 border border-border/30">
      <div className="flex items-center justify-between">
        <div className="w-16 h-3 bg-surface-elevated rounded" />
        <div className="w-8 h-8 rounded-xl bg-surface-elevated" />
      </div>
      <div className="w-24 h-8 bg-surface-elevated rounded mt-2" />
      <div className="w-32 h-3.5 bg-surface-elevated rounded mt-1" />
    </div>
  );

  const greetingName = user?.full_name ? user.full_name.split(" ")[0] : "Prakshit";

  return (
    <div ref={pageRef} className="space-y-6 pb-12 text-foreground max-w-6xl mx-auto">
      
      {/* ─── HEADER SECTION ─── */}
      <div className="dashboard-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            Good morning, {greetingName} 👋
          </h1>
          <p className="text-sm text-muted mt-1 font-light">
            Monday, 9 June · 42 days until your next target deadline
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Pill search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search sheets, problems..."
              className="pl-9 pr-4 py-2 text-xs rounded-full border border-border bg-surface/40 hover:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-foreground/20 w-44 md:w-56 text-foreground transition-all duration-300 placeholder:text-muted/60"
            />
          </div>

          <ThemeToggle />

          {/* Bell notification */}
          <button className="relative w-9 h-9 rounded-full border border-border bg-surface/40 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:border-foreground/30 transition-all duration-300">
            <Bell className="h-4.5 w-4.5 text-foreground opacity-80" />
            <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
          </button>
        </div>
      </div>

      {/* ─── STATS ROW (4-column Grid) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {showSkeleton || loading ? (
          <>
            {renderStatSkeleton()}
            {renderStatSkeleton()}
            {renderStatSkeleton()}
            {renderStatSkeleton()}
          </>
        ) : (
          <>
            {/* Card 1: Streak */}
            <div className="glass-card p-5 hover-glow stat-card-anim flex items-center justify-between border border-border/50 relative overflow-hidden group">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] uppercase tracking-widest font-semibold text-muted mb-1">
                  Day Streak
                </span>
                <span ref={streakRef} className="text-3xl font-bold font-mono text-foreground leading-tight">
                  0
                </span>
                <span className="text-[11px] text-muted mt-1 truncate">
                  Start today to build momentum
                </span>
              </div>
              <div className="p-3 rounded-xl bg-warning/10 text-warning shrink-0 transition-transform group-hover:scale-110">
                <Flame className="h-6 w-6" />
              </div>
            </div>

            {/* Card 2: Solved */}
            <div className="glass-card p-5 hover-glow stat-card-anim flex flex-col justify-between border border-border/50 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] uppercase tracking-widest font-semibold text-muted mb-1">
                    Questions Solved
                  </span>
                  <span className="text-3xl font-bold font-mono text-foreground leading-tight">
                    <span ref={solvedRef}>0</span>
                    <span className="text-muted text-lg font-light"> / 450</span>
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-success/10 text-success shrink-0 transition-transform group-hover:scale-110">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>
              <div className="w-full h-1 bg-border rounded-full overflow-hidden mt-3 shrink-0">
                <div
                  className="h-full bg-success transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(100, (totalCompleted / 450) * 100)}%` }}
                />
              </div>
            </div>

            {/* Card 3: Active Sheets */}
            <div className="glass-card p-5 hover-glow stat-card-anim flex items-center justify-between border border-border/50 relative overflow-hidden group">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] uppercase tracking-widest font-semibold text-muted mb-1">
                  Active Sheets
                </span>
                <span ref={sheetsRef} className="text-3xl font-bold font-mono text-foreground leading-tight">
                  0
                </span>
                <span className="text-[11px] text-muted mt-1 truncate">
                  Across 4 companies
                </span>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary-light shrink-0 transition-transform group-hover:scale-110">
                <Layers className="h-6 w-6" />
              </div>
            </div>

            {/* Card 4: AI Readiness */}
            <div className="glass-card p-5 hover-glow stat-card-anim flex items-center justify-between border border-border/50 relative overflow-hidden group">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] uppercase tracking-widest font-semibold text-muted mb-1">
                  AI Readiness
                </span>
                <span ref={readinessRef} className="text-3xl font-bold font-mono text-foreground leading-tight">
                  {sheets.length > 0 ? "0%" : "—"}
                </span>
                <span className="text-[11px] text-muted mt-1 truncate">
                  {sheets.length > 0 ? "Complete a sheet to unlock" : "Complete a sheet to unlock"}
                </span>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="p-3 rounded-xl bg-primary/10 text-foreground transition-transform group-hover:scale-110">
                  <Target className="h-6 w-6" />
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border font-medium text-muted">
                  Powered by AI
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── ACTIVITY HEATMAP SECTION ─── */}
      <div className="glass-card p-6 border border-border/50 heatmap-section relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-[0.02] pointer-events-none" />
        <div className="flex items-center justify-between mb-6 relative z-10">
          <h3 className="section-heading-anim text-[13px] uppercase tracking-widest font-medium text-muted">
            Solving Activity
          </h3>
          <span className="text-xs px-3 py-1.5 rounded-full border border-border bg-surface/50 text-muted font-medium cursor-default">
            Last 6 months
          </span>
        </div>

        <div className="flex flex-col gap-2 overflow-x-auto relative z-10 select-none pb-2">
          {/* Month labels */}
          <div className="flex pl-8 text-[10px] text-muted relative" style={{ width: "fit-content" }}>
            <div className="flex gap-[43px]">
              <span>Dec</span>
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
            </div>
          </div>

          <div className="flex gap-3 items-start" style={{ width: "fit-content" }}>
            {/* Weekday labels */}
            <div className="flex flex-col justify-around text-[10px] text-muted h-[106px] w-5 pr-1 font-mono">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* Heatmap cells (26 cols x 7 rows) */}
            <div className="grid grid-flow-col grid-cols-26 grid-rows-7 gap-1.5">
              {heatmapData.map((cell, i) => (
                <div
                  key={i}
                  className="heatmap-cell w-3 h-3 rounded-[3px] transition-all hover:scale-125 hover:z-10 cursor-pointer relative group"
                  style={{ backgroundColor: getCellBg(cell.value) }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 bg-foreground text-background text-[10px] py-1 px-2 rounded font-mono shadow-md whitespace-nowrap leading-none">
                    {cell.value} solved · {cell.date}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── TWO-COLUMN MIDDLE ROW ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* LEFT COLUMN: Your Sheets (60% / 6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4 sheets-section">
          <div className="flex items-center justify-between">
            <h3 className="section-heading-anim text-[13px] uppercase tracking-widest font-medium text-muted">
              Your Sheets
            </h3>
            <Link
              href="/sheets/new"
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className="magnetic-btn text-[11px] px-3.5 py-1.5 border border-border text-foreground hover:border-foreground/30 transition-all font-semibold rounded-full flex items-center gap-1.5"
            >
              New Sheet <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3 flex-1">
            {showSkeleton || loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card p-5 animate-pulse border border-border/30 h-20 bg-surface-elevated/40" />
              ))
            ) : sheets.length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 h-full min-h-[200px]">
                <Layers className="h-8 w-8 text-muted opacity-30" />
                <p className="text-sm text-muted">No sheets yet. Create your first one →</p>
                <Link
                  href="/sheets/new"
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="magnetic-btn text-[11px] mt-1 px-4 py-2 bg-foreground text-background font-medium rounded-full hover:opacity-90 transition-opacity"
                >
                  Create Sheet
                </Link>
              </div>
            ) : (
              sheets.slice(0, 5).map((sheet: any) => {
                const total = sheet.total_questions || 30;
                const solved = sheet.solved_questions_count ?? (sheet.completion_status === "completed" ? total : sheet.completion_status === "in_progress" ? Math.floor(total * 0.4) : 0);
                const pct = Math.round((solved / total) * 100);

                return (
                  <Link
                    key={sheet.id}
                    href={`/sheets/${sheet.id}${sheet.is_personalized ? "?type=personalized" : ""}`}
                    className="glass-card p-4 block group transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_var(--glow-color)] border border-border/50 hover:border-r-2 hover:border-r-foreground/45 relative overflow-hidden sheet-card-anim"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Custom premium logo placeholder */}
                        <div className="w-10 h-10 rounded-lg metallic-mesh-dark border border-zinc-800 flex items-center justify-center text-foreground font-bold font-mono text-base shrink-0 select-none">
                          {sheet.company ? sheet.company.charAt(0).toUpperCase() : "?"}
                        </div>

                        <div className="flex flex-col min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[14px] text-foreground truncate">{sheet.company}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-surface-elevated border border-border text-muted rounded uppercase font-semibold shrink-0">
                              {sheet.role || "SDE"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted font-light">
                            <span>{sheet.duration_days} days</span>
                            <span>·</span>
                            {sheet.completion_status === "in_progress" ? (
                              <span>{solved} / {total} solved</span>
                            ) : (
                              <span className="capitalize">{sheet.completion_status?.replace("_", " ")}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={clsx(
                            "text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-semibold border",
                            sheet.completion_status === "completed"
                              ? "badge-easy"
                              : sheet.completion_status === "in_progress"
                              ? "badge-medium"
                              : "badge-hard"
                          )}
                        >
                          {sheet.completion_status === "completed"
                            ? "Completed"
                            : sheet.completion_status === "in_progress"
                            ? "In Progress"
                            : "Not Started"}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    <div className="w-full h-1 bg-border/40 rounded-full overflow-hidden mt-3.5">
                      <div
                        className="h-full bg-foreground transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                );
              })
            )}
            {sheets.length > 0 && (
              <div className="text-left mt-2">
                <Link
                  href="/dashboard#sheets"
                  className="text-xs text-muted hover:text-foreground font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  View All Sheets <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Quick Actions + Upcoming (40% / 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Quick Actions */}
          <div className="flex flex-col gap-3">
            <h3 className="section-heading-anim text-[13px] uppercase tracking-widest font-medium text-muted text-left">
              Quick Actions
            </h3>
            
            <Link
              href="/sheets/new"
              className="glass-card p-4 flex items-center justify-between group hover:scale-[1.02] hover:bg-surface-elevated/40 transition-all duration-300 border border-border/50 block text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary-light shrink-0">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-foreground">Create New Sheet</h4>
                  <p className="text-[11px] text-muted font-light mt-0.5 truncate">
                    Generate an interview prep plan
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground transition-colors group-hover:translate-x-0.5 shrink-0" />
            </Link>

            <Link
              href="/search"
              className="glass-card p-4 flex items-center justify-between group hover:scale-[1.02] hover:bg-surface-elevated/40 transition-all duration-300 border border-border/50 block text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary-light shrink-0">
                  <Search className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-foreground">Search Problems</h4>
                  <p className="text-[11px] text-muted font-light mt-0.5 truncate">
                    Browse templates and questions
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground transition-colors group-hover:translate-x-0.5 shrink-0" />
            </Link>
          </div>

          {/* Upcoming Reviews */}
          <div className="glass-card p-5 border border-border/50 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border/30 pb-2 text-left">
              <CalendarDays className="h-4.5 w-4.5 text-muted shrink-0" />
              <h3 className="section-heading-anim text-[13px] uppercase tracking-widest font-medium text-muted">
                Due for Review
              </h3>
            </div>

            <div className="space-y-2.5">
              {mockReviews.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface/30 border border-border/30 hover:border-border/60 transition-colors"
                >
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-xs font-semibold text-foreground truncate">{item.title}</span>
                    <span className={clsx("text-[10px] mt-0.5 font-medium", item.isWarning ? "text-warning" : "text-muted")}>
                      {item.due}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      "text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-semibold border shrink-0",
                      item.difficulty === "easy"
                        ? "badge-easy"
                        : item.difficulty === "medium"
                        ? "badge-medium"
                        : "badge-hard"
                    )}
                  >
                    {item.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ─── TOPIC BREAKDOWN CHART SECTION ─── */}
      <div className="glass-card p-6 border border-border/50 chart-section relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-[0.02] pointer-events-none" />
        
        <div className="mb-6 relative z-10 flex flex-col text-left">
          <h3 className="section-heading-anim text-[13px] uppercase tracking-widest font-medium text-muted">
            Topic Coverage
          </h3>
          <p className="text-xs text-muted font-light mt-0.5">See where your gaps are</p>
        </div>

        <div className="w-full h-[280px] flex items-center justify-center relative z-10">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={topicData}>
                <PolarGrid stroke="var(--border)" strokeOpacity={0.4} />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 500 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: "var(--muted)", fontSize: 9 }}
                  axisLine={false}
                />
                <Radar
                  name="Mastery"
                  dataKey="count"
                  stroke="var(--foreground)"
                  fill="var(--foreground)"
                  fillOpacity={0.12}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="animate-pulse h-full w-full bg-surface-elevated rounded-xl" />
          )}
        </div>
      </div>

    </div>
  );
}
