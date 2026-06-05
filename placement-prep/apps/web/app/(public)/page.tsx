"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import {
  Terminal,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  MessageSquare,
  RefreshCw,
  Gauge,
  Cpu,
  Search,
  Flame,
  Activity
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AntigravityParticles from "@/components/AntigravityParticles";
import ParallaxCard from "@/components/ParallaxCard";

// Custom hook to interpolate scroll progress for a section
function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Calculate when the element enters from bottom to when it exits at top
      const start = rect.top - viewportHeight;
      const end = rect.bottom;
      const totalRange = end - start;

      if (totalRange <= 0) return;

      // Calculate progress percentage (0 at entry, 1 at exit)
      const current = -start;
      const rawProgress = current / totalRange;
      const clamped = Math.max(0, Math.min(1, rawProgress));
      setProgress(clamped);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Trigger initial calculation
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return { ref, progress };
}

export default function LandingPage() {
  const [activeExplainTab, setActiveExplainTab] = useState<"analogy" | "dryrun" | "hints" | "complexity">("analogy");
  const [activeSyncState, setActiveSyncState] = useState<"idle" | "fetching" | "completed">("idle");
  const [syncFetchedCount, setSyncFetchedCount] = useState(0);
  const [heroScrollY, setHeroScrollY] = useState(0);

  // Monitor scroll height specifically for hero parallax
  useEffect(() => {
    const handleScroll = () => {
      setHeroScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sync progress mock loop
  useEffect(() => {
    if (activeSyncState === "fetching") {
      const interval = setInterval(() => {
        setSyncFetchedCount((prev) => {
          if (prev >= 480) {
            clearInterval(interval);
            setActiveSyncState("completed");
            return 480;
          }
          return prev + 60;
        });
      }, 400);
      return () => clearInterval(interval);
    }
  }, [activeSyncState]);

  const triggerSyncDemo = () => {
    setSyncFetchedCount(0);
    setActiveSyncState("fetching");
  };

  // Apple scroll calculations for sections
  const bentoSection = useScrollProgress();
  const syncSection = useScrollProgress();
  const readinessSection = useScrollProgress();
  const assistantSection = useScrollProgress();
  const semanticSection = useScrollProgress();
  const faqSection = useScrollProgress();

  // Hero calculation: fade out and translate up as scroll moves
  const heroOpacity = Math.max(0, 1 - heroScrollY / 500);
  const heroScale = Math.max(0.92, 1 - heroScrollY / 3000);
  const heroTranslateY = -heroScrollY * 0.15;

  // Bento zoom transition: scale from 0.85 -> 1.05, rotateX from 25deg -> 0deg based on scroll ratio
  const bentoInterp = Math.min(1, bentoSection.progress / 0.55); // complete transition by halfway mark
  const bentoScale = 0.85 + bentoInterp * 0.2;
  const bentoRotateX = 25 - bentoInterp * 25;
  const bentoTranslateY = 60 - bentoInterp * 60;

  // Divider lines expansion transition
  const getLineScale = (prog: number) => {
    // line expands from center 0% to 100%
    return Math.min(1, prog * 2);
  };

  // Magnetic button triggers
  const handleMagneticMove = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    el.style.setProperty("--bx", `${(e.clientX - rect.left)}px`);
    el.style.setProperty("--by", `${(e.clientY - rect.top)}px`);
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    el.style.transform = "translate(0, 0)";
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-background">
      {/* Background grid + sweep */}
      <div className="fixed inset-0 z-0 grid-bg" aria-hidden="true">
        <div className="grid-sweep" />
      </div>

      {/* Particles */}
      <AntigravityParticles />

      {/* ─────────── NAV ─────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40">
        <div
          className="backdrop-blur-xl bg-background/70 transition-colors duration-500"
          style={{ WebkitBackdropFilter: "blur(20px)" }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Terminal className="h-5 w-5 text-foreground opacity-70 group-hover:opacity-100 transition-opacity" />
              <span className="text-[15px] font-light tracking-wide">
                Prep<span className="font-semibold">Assist</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a
                href="#sync"
                className="text-[11px] text-muted hover:text-foreground transition-colors tracking-widest uppercase font-mono"
              >
                Deep Sync
              </a>
              <a
                href="#readiness"
                className="text-[11px] text-muted hover:text-foreground transition-colors tracking-widest uppercase font-mono"
              >
                Readiness Index
              </a>
              <a
                href="#assistant"
                className="text-[11px] text-muted hover:text-foreground transition-colors tracking-widest uppercase font-mono"
              >
                AI Assistant
              </a>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="text-[13px] text-muted hover:text-foreground transition-colors cursor-pointer px-3 py-1.5 font-light">
                    Sign In
                  </button>
                </SignInButton>
                <Link
                  href="/sign-up"
                  className="px-5 py-2 text-[13px] font-medium bg-foreground text-background rounded-full hover:opacity-90 transition-opacity"
                >
                  Get Started
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="px-5 py-2 text-[13px] font-medium bg-foreground text-background rounded-full hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Show>
            </div>
          </div>
        </div>
      </nav>

      {/* ─────────── HERO ─────────── */}
      <section 
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-40 pb-20 text-center scroll-smooth-interpolate"
        style={{
          opacity: heroOpacity,
          transform: `translate3d(0, ${heroTranslateY}px, 0) scale(${heroScale})`,
          filter: `blur(${heroScrollY * 0.015}px)`
        }}
      >
        <div className="max-w-4xl">
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-10 rounded-full border border-border bg-surface/40 text-[11px] uppercase tracking-[0.18em] text-muted font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Real-time LeetCode profile analytics enabled
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl md:text-[5.5rem] leading-[1.02] tracking-tight mb-8">
            <span className="font-extralight block">Personalized study plans for</span>
            <span className="font-bold gradient-text">your dream tech offers</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-muted max-w-2xl mx-auto mb-12 leading-relaxed font-light">
            Stop solving random questions. PrepAssist syncs your LeetCode metrics and uses
            AI to generate custom, day-by-day study calendars targeting top companies.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="magnetic-btn px-8 py-3.5 bg-foreground text-background font-medium text-[14px] rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
              >
                Create study plan <ChevronRight className="h-4 w-4" />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/sheets/new"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="magnetic-btn px-8 py-3.5 bg-foreground text-background font-medium text-[14px] rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
              >
                Create study plan <ChevronRight className="h-4 w-4" />
              </Link>
            </Show>
            <Link
              href="/sheets/new"
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className="magnetic-btn px-8 py-3.5 border border-border text-foreground/75 hover:text-foreground font-medium text-[14px] rounded-full hover:border-foreground/30 transition-all"
            >
              Explore Templates
            </Link>
          </div>
        </div>
      </section>

      {/* Decorative scroll-drawn line */}
      <div className="max-w-6xl mx-auto w-full px-6">
        <div 
          className="scroll-draw-line scroll-smooth-interpolate" 
          style={{ transform: `scaleX(${getLineScale(bentoSection.progress)})` }}
        />
      </div>

      {/* ─────────── BENTO PREVIEW (APPLE MACBOOK ZOOM) ─────────── */}
      <section ref={bentoSection.ref} id="preview" className="relative z-10 px-6 py-28 scroll-reveal-container">
        <div 
          className="max-w-5xl mx-auto scroll-smooth-interpolate"
          style={{
            transform: `translate3d(0, ${bentoTranslateY}px, 0) scale(${bentoScale}) rotateX(${bentoRotateX}deg)`,
            opacity: Math.min(1, bentoSection.progress * 2.5),
          }}
        >
          <ParallaxCard className="w-full" tilt={2.5}>
            <div className="glass-card p-1 border border-border/40 overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border/30">
                <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                <span className="ml-4 text-[10px] text-muted font-mono tracking-widest uppercase">
                  PrepAssist — Study Planner Dashboard Preview
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-px bg-border/20">
                {/* Schedule panel */}
                <div className="md:col-span-2 p-8 space-y-6 bg-surface/40">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold tracking-wide">
                      Target: Google SWE L4
                    </h3>
                    <span className="text-[10px] text-muted font-mono uppercase tracking-widest">
                      Week 1 / 6
                    </span>
                  </div>

                  {[
                    { day: "Day 1", topic: "Arrays & Hashing", done: true, badge: "Easy" },
                    { day: "Day 2", topic: "Dynamic Programming", done: false, badge: "Hard" },
                    { day: "Day 3", topic: "Graphs & BFS / DFS", done: false, badge: "Medium" },
                  ].map((item) => (
                    <div
                      key={item.day}
                      className="flex items-center gap-4 py-4 px-5 rounded-xl border border-border/30 bg-surface/60 hover:border-foreground/10 hover:bg-surface-elevated/40 transition-all duration-300"
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted/30 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] text-muted font-mono uppercase tracking-widest block mb-0.5">
                          {item.day}
                        </span>
                        <p className={`text-sm ${item.done ? "line-through text-muted/70" : "text-foreground"}`}>
                          {item.topic}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider ${
                          item.badge === "Easy"
                            ? "badge-easy"
                            : item.badge === "Hard"
                              ? "badge-hard"
                              : "badge-medium"
                        }`}
                      >
                        {item.badge}
                      </span>
                    </div>
                  ))}
                </div>

                {/* AI chat panel */}
                <div className="p-8 flex flex-col justify-between bg-surface/20 min-h-[300px]">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted">
                    <Sparkles className="h-4 w-4 text-foreground/60" />
                    AI Assistant
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3 items-start">
                      <MessageSquare className="h-4 w-4 mt-1 text-muted shrink-0" />
                      <p className="text-[13px] text-muted leading-relaxed font-light">
                        Based on your target role at Google, I recommend
                        focusing on <span className="text-foreground font-medium">Dynamic Programming</span> today.
                        35% of L4 interviews feature DP.
                      </p>
                    </div>
                    
                    <button className="w-full text-center text-[12px] font-medium py-2.5 bg-foreground text-background hover:opacity-90 rounded-lg transition-opacity cursor-pointer">
                      Load DP practice →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ParallaxCard>
        </div>
      </section>

      {/* Decorative scroll-drawn line */}
      <div className="max-w-6xl mx-auto w-full px-6">
        <div 
          className="scroll-draw-line scroll-smooth-interpolate" 
          style={{ transform: `scaleX(${getLineScale(syncSection.progress)})` }}
        />
      </div>

      {/* ─────────── FEATURE SECTION 1: LEETCODE DEEP SYNC ─────────── */}
      <section ref={syncSection.ref} id="sync" className="relative z-10 px-6 py-28 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          
          {/* Slide left + perspective rotate in */}
          <div 
            className="md:col-span-5 space-y-6 text-left scroll-smooth-interpolate"
            style={{
              transform: `translate3d(${-60 + Math.min(1, syncSection.progress / 0.5) * 60}px, 0, 0) rotateY(${15 - Math.min(1, syncSection.progress / 0.5) * 15}deg)`,
              opacity: Math.min(1, syncSection.progress * 3.5)
            }}
          >
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <RefreshCw className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extralight tracking-tight text-foreground">
              LeetCode Deep Sync <span className="font-semibold block">Browser Extension</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Install the lightweight chrome extension to extract your detailed LeetCode submission history in one click. 
              We map your raw timestamps, errors, and optimal solutions directly into your dashboard.
            </p>
            <div className="space-y-3 pt-2 font-mono text-[12px] text-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Secure local session token syncing
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Raw submission history extraction
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Automatic performance profiling
              </div>
            </div>
          </div>

          {/* Slide right + scale zoom */}
          <div 
            className="md:col-span-7 scroll-smooth-interpolate"
            style={{
              transform: `translate3d(${60 - Math.min(1, syncSection.progress / 0.5) * 60}px, 0, 0) scale(${0.9 + Math.min(1, syncSection.progress / 0.5) * 0.1})`,
              opacity: Math.min(1, syncSection.progress * 3)
            }}
          >
            <ParallaxCard className="w-full" tilt={2}>
              <div className="glass-card p-6 border border-border/40 space-y-5 text-left font-mono">
                <div className="flex items-center justify-between border-b border-border/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                    <span className="text-[11px] text-muted uppercase tracking-wider">Sync Controller v1.4</span>
                  </div>
                  <span className="text-[10px] text-muted">ID: leetcode_agent_secure</span>
                </div>

                <div className="space-y-4 py-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Target User:</span>
                    <span className="text-foreground">lc_coder_pro</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Sync Scope:</span>
                    <span className="text-foreground">All Submissions (1 Year)</span>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-[11px] text-muted">
                      <span>Sync Progress</span>
                      <span>{syncFetchedCount} Submissions</span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden border border-border/30">
                      <div 
                        className="h-full bg-foreground transition-all duration-300"
                        style={{ width: `${(syncFetchedCount / 480) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted">
                    {activeSyncState === "idle" && "Ready to sync."}
                    {activeSyncState === "fetching" && "Extracting raw chunk batches..."}
                    {activeSyncState === "completed" && "Sync complete. 480 items cached."}
                  </span>
                  <button 
                    onClick={triggerSyncDemo}
                    className="px-4 py-2 bg-foreground text-background hover:opacity-90 rounded-lg text-xs font-semibold font-sans transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`h-3 w-3 ${activeSyncState === "fetching" ? "animate-spin" : ""}`} />
                    {activeSyncState === "idle" && "Trigger Sync"}
                    {activeSyncState === "fetching" && "Syncing..."}
                    {activeSyncState === "completed" && "Re-sync"}
                  </button>
                </div>
              </div>
            </ParallaxCard>
          </div>
        </div>
      </section>

      {/* Decorative scroll-drawn line */}
      <div className="max-w-6xl mx-auto w-full px-6">
        <div 
          className="scroll-draw-line scroll-smooth-interpolate" 
          style={{ transform: `scaleX(${getLineScale(readinessSection.progress)})` }}
        />
      </div>

      {/* ─────────── FEATURE SECTION 2: READINESS INDEX ─────────── */}
      <section ref={readinessSection.ref} id="readiness" className="relative z-10 px-6 py-28 bg-surface/5 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          
          {/* Slide left + rotate */}
          <div 
            className="md:col-span-7 order-2 md:order-1 scroll-smooth-interpolate"
            style={{
              transform: `translate3d(${-60 + Math.min(1, readinessSection.progress / 0.5) * 60}px, 0, 0) scale(${0.9 + Math.min(1, readinessSection.progress / 0.5) * 0.1})`,
              opacity: Math.min(1, readinessSection.progress * 3)
            }}
          >
            <ParallaxCard className="w-full" tilt={2}>
              <div className="glass-card p-6 border border-border/40 space-y-6 text-left">
                <div className="flex items-end justify-between border-b border-border/10 pb-4">
                  <div>
                    <span className="text-[10px] text-muted font-mono uppercase tracking-widest block mb-1">Live Evaluation</span>
                    <h3 className="text-lg font-semibold text-foreground">Google SWE L4 Target</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-bold text-foreground">72%</span>
                    <span className="text-[10px] text-muted block font-mono">Readiness Score</span>
                  </div>
                </div>

                <div className="space-y-4 font-mono text-[11px]">
                  {[
                    { topic: "Dynamic Programming", val: 35, badge: "Hard" },
                    { topic: "Graphs & BFS / DFS", val: 60, badge: "Medium" },
                    { topic: "Arrays & Hashing", val: 95, badge: "Easy" },
                    { topic: "Sliding Window", val: 80, badge: "Medium" },
                  ].map((topicItem) => (
                    <div key={topicItem.topic} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-foreground/80">{topicItem.topic}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${
                            topicItem.badge === "Easy" ? "badge-easy" : topicItem.badge === "Hard" ? "badge-hard" : "badge-medium"
                          }`}>{topicItem.badge}</span>
                          <span className="text-foreground font-semibold">{topicItem.val}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-foreground transition-all duration-700" 
                          style={{ width: `${topicItem.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border/10 flex items-center justify-between text-[11px] text-muted font-mono">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-success animate-pulse" />
                    ~3 weeks estimated to reach 85% readiness target.
                  </span>
                </div>
              </div>
            </ParallaxCard>
          </div>

          {/* Slide right + perspective rotate in */}
          <div 
            className="md:col-span-5 order-1 md:order-2 space-y-6 text-left scroll-smooth-interpolate"
            style={{
              transform: `translate3d(${60 - Math.min(1, readinessSection.progress / 0.5) * 60}px, 0, 0) rotateY(${-15 + Math.min(1, readinessSection.progress / 0.5) * 15}deg)`,
              opacity: Math.min(1, readinessSection.progress * 3.5)
            }}
          >
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <Gauge className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extralight tracking-tight text-foreground">
              Real-Time Company <span className="font-semibold block">Readiness Index</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              PrepAssist evaluates your topic-by-topic solve rate against past interview data from target firms. 
              We calculate exactly how prepared you are and identify critical blind spots you must fix.
            </p>
            <div className="space-y-3 pt-2 font-mono text-[12px] text-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Target company success probabilities
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Topic weightage alignment
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Estimated time-to-target calculations
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Decorative scroll-drawn line */}
      <div className="max-w-6xl mx-auto w-full px-6">
        <div 
          className="scroll-draw-line scroll-smooth-interpolate" 
          style={{ transform: `scaleX(${getLineScale(assistantSection.progress)})` }}
        />
      </div>

      {/* ─────────── FEATURE SECTION 3: AI PROBLEM ASSISTANT ─────────── */}
      <section ref={assistantSection.ref} id="assistant" className="relative z-10 px-6 py-28 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          
          {/* Slide left + perspective rotate in */}
          <div 
            className="md:col-span-5 space-y-6 text-left scroll-smooth-interpolate"
            style={{
              transform: `translate3d(${-60 + Math.min(1, assistantSection.progress / 0.5) * 60}px, 0, 0) rotateY(${15 - Math.min(1, assistantSection.progress / 0.5) * 15}deg)`,
              opacity: Math.min(1, assistantSection.progress * 3.5)
            }}
          >
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <Cpu className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extralight tracking-tight text-foreground">
              AI Problem Assistant <span className="font-semibold block">Interactive Copilot</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Get stuck? Leverage progressive prompts, interactive variable trace dry runs, code translations in 9 languages, and Big-O efficiency analysis built directly into the side pane.
            </p>
            <div className="space-y-3 pt-2 font-mono text-[12px] text-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Analogies for dry concepts
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Step-by-step trace tables
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                3-level hints (direction to logic)
              </div>
            </div>
          </div>

          {/* Slide right + scale zoom */}
          <div 
            className="md:col-span-7 scroll-smooth-interpolate"
            style={{
              transform: `translate3d(${60 - Math.min(1, assistantSection.progress / 0.5) * 60}px, 0, 0) scale(${0.9 + Math.min(1, assistantSection.progress / 0.5) * 0.1})`,
              opacity: Math.min(1, assistantSection.progress * 3)
            }}
          >
            <ParallaxCard className="w-full" tilt={2}>
              <div className="glass-card border border-border/40 overflow-hidden font-mono text-[12px] text-left">
                <div className="flex justify-between items-center px-5 py-3 border-b border-border/20 bg-surface/30">
                  <span className="text-xs font-semibold text-foreground">AI Copilot: Edit Distance</span>
                  <span className="text-[9px] px-2 py-0.5 border border-border rounded-full text-muted uppercase">Premium</span>
                </div>

                <div className="flex gap-2 px-4 border-b border-border/20 bg-surface/10">
                  {[
                    { id: "analogy", label: "Analogy" },
                    { id: "dryrun", label: "Dry Run" },
                    { id: "hints", label: "Hints" },
                    { id: "complexity", label: "Complexity" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveExplainTab(tab.id as any)}
                      className={`px-3 py-2.5 font-sans border-b-2 transition-colors cursor-pointer ${
                        activeExplainTab === tab.id 
                          ? "border-foreground text-foreground font-semibold" 
                          : "border-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6 min-h-[220px] bg-surface/40 flex flex-col justify-between">
                  {activeExplainTab === "analogy" && (
                    <div className="space-y-2">
                      <span className="text-[10px] text-muted uppercase">🎯 Conceptual Analogy:</span>
                      <p className="text-muted leading-relaxed font-sans font-light">
                        Imagine translating one book to another line-by-line. 
                        You can keep a word (copy), scratch it out (delete), insert a new word, 
                        or replace a word. The Edit Distance represents the minimum number of pen strokes needed.
                      </p>
                    </div>
                  )}

                  {activeExplainTab === "dryrun" && (
                    <div className="space-y-3">
                      <span className="text-[10px] text-muted uppercase">🔄 Variable Trace Steps:</span>
                      <div className="space-y-1.5">
                        <div className="p-2 border border-border/20 bg-surface/30 rounded flex justify-between">
                          <span>Step 1: i=1, j=1 ("a" vs "b")</span>
                          <span className="text-warning">Cost = 1</span>
                        </div>
                        <div className="p-2 border border-border/20 bg-surface/30 rounded flex justify-between">
                          <span>Step 2: i=2, j=2 ("ac" vs "bc")</span>
                          <span className="text-success">Match = 0</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeExplainTab === "hints" && (
                    <div className="space-y-3">
                      <span className="text-[10px] text-muted uppercase">🔑 Progressive Hints:</span>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[9px]">L1</span>
                          <p className="text-muted font-sans font-light">Consider how deleting a character changes the sub-problem indexes.</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[9px]">L2</span>
                          <p className="text-muted font-sans font-light">The cost matrix dp[i][j] stores the edit distance of strings s1[0..i] and s2[0..j].</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeExplainTab === "complexity" && (
                    <div className="space-y-3">
                      <span className="text-[10px] text-muted uppercase">📊 Complexity breakdown:</span>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 border border-border/20 rounded bg-surface/20 text-center">
                          <span className="text-[10px] text-muted block">Time Complexity</span>
                          <span className="font-bold text-foreground text-sm">O(M × N)</span>
                        </div>
                        <div className="p-3 border border-border/20 rounded bg-surface/20 text-center">
                          <span className="text-[10px] text-muted block">Space Complexity</span>
                          <span className="font-bold text-foreground text-sm">O(M × N)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/15 flex items-center justify-between text-[11px] text-muted font-sans">
                    <span>Active Language: Python</span>
                    <span className="hover:underline cursor-pointer font-semibold">View source code →</span>
                  </div>
                </div>
              </div>
            </ParallaxCard>
          </div>
        </div>
      </section>

      {/* Decorative scroll-drawn line */}
      <div className="max-w-6xl mx-auto w-full px-6">
        <div 
          className="scroll-draw-line scroll-smooth-interpolate" 
          style={{ transform: `scaleX(${getLineScale(semanticSection.progress)})` }}
        />
      </div>

      {/* ─────────── NEW FEATURE SECTION: SEMANTIC FILTER SEARCH ─────────── */}
      <section ref={semanticSection.ref} className="relative z-10 px-6 py-28 bg-surface/5 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          
          {/* Slide left + rotate */}
          <div 
            className="md:col-span-7 order-2 md:order-1 scroll-smooth-interpolate"
            style={{
              transform: `translate3d(${-60 + Math.min(1, semanticSection.progress / 0.5) * 60}px, 0, 0) scale(${0.9 + Math.min(1, semanticSection.progress / 0.5) * 0.1})`,
              opacity: Math.min(1, semanticSection.progress * 3)
            }}
          >
            <ParallaxCard className="w-full" tilt={2}>
              <div className="glass-card p-6 border border-border/40 space-y-5 text-left">
                <div className="flex gap-2 p-2 border border-border bg-surface/60 rounded-xl items-center">
                  <Search className="h-4 w-4 text-muted ml-2" />
                  <span className="text-sm font-light text-foreground flex-1">
                    "Hard dynamic programming questions asked in Google SWE interviews"
                  </span>
                  <span className="px-2.5 py-1 bg-foreground text-background text-xs font-medium rounded-lg font-mono">SEARCH</span>
                </div>

                <div className="space-y-3 font-mono text-[11px] pt-1">
                  <span className="text-[10px] text-muted block">AI EXTRACTED PARAMS:</span>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded bg-foreground/5 border border-border text-foreground">Company: Google</span>
                    <span className="px-2.5 py-1 rounded bg-foreground/5 border border-border text-foreground">Difficulty: Hard</span>
                    <span className="px-2.5 py-1 rounded bg-foreground/5 border border-border text-foreground">Topic: Dynamic Programming</span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/10 pt-4 font-mono text-[11px]">
                  <span className="text-[10px] text-muted block">EXPANDED SEMANTIC VARIANTS:</span>
                  <ul className="space-y-1 text-muted text-xs font-sans font-light">
                    <li>• "Find min cost climbing stairs Google L4 questions"</li>
                    <li>• "Google hard DP recursive matrix chain multiplication"</li>
                  </ul>
                </div>
              </div>
            </ParallaxCard>
          </div>

          {/* Slide right + perspective rotate in */}
          <div 
            className="md:col-span-5 order-1 md:order-2 space-y-6 text-left scroll-smooth-interpolate"
            style={{
              transform: `translate3d(${60 - Math.min(1, semanticSection.progress / 0.5) * 60}px, 0, 0) rotateY(${-15 + Math.min(1, semanticSection.progress / 0.5) * 15}deg)`,
              opacity: Math.min(1, semanticSection.progress * 3.5)
            }}
          >
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <Search className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extralight tracking-tight text-foreground">
              Semantic AI <span className="font-semibold block">Problem Filter</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Type query strings in natural conversational English. The integrated AI expander extracts explicit criteria (like company, role, difficulty tags) and matches related syntax variations instantly.
            </p>
            <div className="space-y-3 pt-2 font-mono text-[12px] text-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Conversational query understanding
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Synonym-aware semantic matching
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Multi-constraint parameters extraction
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Decorative scroll-drawn line */}
      <div className="max-w-6xl mx-auto w-full px-6">
        <div 
          className="scroll-draw-line scroll-smooth-interpolate" 
          style={{ transform: `scaleX(${getLineScale(faqSection.progress)})` }}
        />
      </div>

      {/* ─────────── DEEP DIVE QUESTIONS (SCROLL ROTATE) ─────────── */}
      <section ref={faqSection.ref} className="relative z-10 px-6 py-28 max-w-4xl mx-auto text-left scroll-reveal-container">
        <div
          className="scroll-smooth-interpolate"
          style={{
            transform: `translate3d(0, ${40 - Math.min(1, faqSection.progress / 0.5) * 40}px, 0)`,
            opacity: Math.min(1, faqSection.progress * 3)
          }}
        >
          <h2 className="text-3xl font-extralight tracking-tight mb-16 text-center">
            Preparation FAQ
          </h2>
          <div className="space-y-6">
            {[
              {
                title: "What templates are supported?",
                desc: "We parse current interview data from 25+ top firms including Google, Amazon, Meta, Netflix, Microsoft, Apple, Uber, Lyft, ByteDance, Airbnb, and Stripe. Sheets range from 15-day sprints to 60-day thorough trackers."
              },
              {
                title: "How does the AI personalization customize my sheet?",
                desc: "If you connect LeetCode profile statistics, our system detects solved patterns. We filter out elements you already master and emphasize topics that present active performance drops, keeping your prep efficient."
              },
              {
                title: "Are solutions and code translations reliable?",
                desc: "Solutions pull verified database answers first. If translations or explanations require dynamic scaling, Google Gemini generates correct alternative Big-O implementations along with line-by-line analyses."
              }
            ].map((faq, i) => (
              <div key={i} className="p-6 glass-card border border-border/30 hover:border-foreground/25 transition-all duration-300">
                <h4 className="text-base font-semibold text-foreground mb-2">{faq.title}</h4>
                <p className="text-sm text-muted leading-relaxed font-light">{faq.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── FOOTER ─────────── */}
      <footer className="relative z-10 border-t border-border/20 px-6 py-8 bg-background/40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-[12px] text-muted">
          <div className="flex items-center gap-3">
            <span className="font-light tracking-wide text-[13px]">
              Prep<span className="font-semibold text-foreground/80">Assist</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-surface/50 text-[10px] font-mono tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
              </span>
              Operational
            </span>
          </div>
          
          <div className="flex items-center gap-8 font-mono text-[10px] uppercase tracking-wider">
            <span className="hover:text-foreground transition-colors cursor-pointer">
              Privacy
            </span>
            <span className="hover:text-foreground transition-colors cursor-pointer">
              Terms
            </span>
            <span className="hover:text-foreground transition-colors cursor-pointer">
              Security
            </span>
          </div>
          
          <span className="font-light text-[11px]">
            © {new Date().getFullYear()} PrepAssist. Built for placements.
          </span>
        </div>
      </footer>
    </div>
  );
}
