"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Flame, Target } from "lucide-react";
import { ProgressRing } from "@/components/ProgressRing";
import { getStreak } from "@/lib/api";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export default function ProgressDashboardPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [streakData, setStreakData] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);

  // Topics and mastery metrics
  const [topicStats, setTopicStats] = useState([
    { title: "Arrays & Strings", completed: 0, total: 30 },
    { title: "Linked Lists", completed: 0, total: 15 },
    { title: "Trees & Graphs", completed: 0, total: 25 },
    { title: "Dynamic Programming", completed: 0, total: 20 },
    { title: "System Design", completed: 0, total: 10 },
  ]);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await getStreak(token);
        if (res.success && res.data) {
          setStreakData(res.data);
          
          let remaining = res.data.total_completed || 0;
          const newStats = topicStats.map(stat => {
            const allocate = Math.min(remaining, Math.floor(stat.total * 0.4));
            remaining -= allocate;
            return { ...stat, completed: allocate };
          });
          if (remaining > 0) {
            newStats[0].completed += remaining;
          }
          setTopicStats(newStats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  // GSAP animations
  useGSAP(() => {
    if (loading) return;

    // 1. Header fade-down
    gsap.fromTo(
      ".progress-header",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );

    // 2. Summary stats cards stagger slide-in
    gsap.fromTo(
      ".summary-card-anim",
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: "power2.out" }
    );

    // 3. Topic Mastery Cards stagger slide-up
    gsap.fromTo(
      ".topic-card-anim",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: "expo.out", delay: 0.15 }
    );

    // 4. Count-up animations
    if (streakRef.current && streakData) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: streakData.current_streak || 0,
        duration: 1.2,
        ease: "expo.out",
        onUpdate: () => {
          if (streakRef.current) streakRef.current.textContent = Math.floor(obj.val).toString();
        },
      });
    }

    if (totalRef.current && streakData) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: streakData.total_completed || 0,
        duration: 1.2,
        ease: "expo.out",
        onUpdate: () => {
          if (totalRef.current) totalRef.current.textContent = Math.floor(obj.val).toString();
        },
      });
    }

  }, { scope: containerRef, dependencies: [loading, streakData] });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-light" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto space-y-6 text-foreground">
      {/* Header */}
      <div className="progress-header border-b border-border/40 pb-6 text-left">
        <h1 className="text-2xl font-bold tracking-tight">Your Progress</h1>
        <p className="text-sm text-muted font-light mt-1">
          Monitor your consistency profile, overall problem count solves, and target mastery ratios.
        </p>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Streak */}
        <div className="glass-card p-6 flex items-center justify-between border border-border/50 hover-glow transition-all duration-300 summary-card-anim group">
          <div className="text-left">
            <p className="text-muted text-xs uppercase tracking-widest font-semibold mb-1">
              Current Consistency
            </p>
            <p className="text-3xl font-bold font-mono text-foreground leading-tight flex items-baseline gap-1">
              <span ref={streakRef}>0</span>
              <span className="text-sm font-normal text-muted font-sans">Days</span>
            </p>
          </div>
          <div className="p-4 rounded-xl bg-warning/10 text-warning shrink-0 transition-transform group-hover:scale-110">
            <Flame className="h-8 w-8" />
          </div>
        </div>

        {/* Total Solved */}
        <div className="glass-card p-6 flex items-center justify-between border border-border/50 hover-glow transition-all duration-300 summary-card-anim group">
          <div className="text-left">
            <p className="text-muted text-xs uppercase tracking-widest font-semibold mb-1">
              Overall Solves
            </p>
            <p className="text-3xl font-bold font-mono text-foreground leading-tight flex items-baseline gap-1">
              <span ref={totalRef}>0</span>
              <span className="text-sm font-normal text-muted font-sans">Questions</span>
            </p>
          </div>
          <div className="p-4 rounded-xl bg-success/10 text-success shrink-0 transition-transform group-hover:scale-110">
            <Target className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Topic Grid */}
      <div className="space-y-4">
        <div className="text-left border-b border-border/30 pb-2">
          <h2 className="text-[13px] uppercase tracking-widest font-medium text-muted">
            Topic Mastery
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {topicStats.map((stat, idx) => (
            <div key={idx} className="topic-card-anim">
              <ProgressRing title={stat.title} completed={stat.completed} total={stat.total} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
