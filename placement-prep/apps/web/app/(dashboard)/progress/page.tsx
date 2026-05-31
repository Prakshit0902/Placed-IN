"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Flame, Target } from "lucide-react";
import { ProgressRing } from "@/components/ProgressRing";
import { getStreak } from "@/lib/api";

export default function ProgressDashboardPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [streakData, setStreakData] = useState<any>(null);

  // In a real app, you would fetch per-topic stats from your backend.
  // We're mocking the topic stats here based on the general total_completed value.
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
          
          // Dummy distribution of total completed among topics for demonstration
          let remaining = res.data.total_completed || 0;
          const newStats = topicStats.map(stat => {
            const allocate = Math.min(remaining, Math.floor(stat.total * 0.4)); // just some random logic to fill it up
            remaining -= allocate;
            return { ...stat, completed: allocate };
          });
          if (remaining > 0) {
            newStats[0].completed += remaining; // dump rest in arrays
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
        <p className="text-muted mt-1">Track your consistency and mastery across topics.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <p className="text-muted text-sm font-medium mb-1">Current Streak</p>
            <p className="text-3xl font-bold">{streakData?.current_streak || 0} Days</p>
          </div>
          <div className="p-4 rounded-full bg-warning/10 text-warning">
            <Flame className="h-8 w-8" />
          </div>
        </div>

        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <p className="text-muted text-sm font-medium mb-1">Total Solved</p>
            <p className="text-3xl font-bold">{streakData?.total_completed || 0} Questions</p>
          </div>
          <div className="p-4 rounded-full bg-success/10 text-success">
            <Target className="h-8 w-8" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-6">Topic Mastery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {topicStats.map((stat, idx) => (
            <ProgressRing key={idx} title={stat.title} completed={stat.completed} total={stat.total} />
          ))}
        </div>
      </div>
    </div>
  );
}
