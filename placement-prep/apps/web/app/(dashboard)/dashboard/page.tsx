"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Flame, FileText, ArrowRight, Sparkles, Clock, Target } from "lucide-react";
import { getStreak, getMySheets, getMe } from "@/lib/api";

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [sheets, setSheets] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-muted mt-1">Here&apos;s your prep overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-warning/10">
            <Flame className="h-6 w-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs text-muted">Day streak</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10">
            <Target className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalCompleted}</p>
            <p className="text-xs text-muted">Questions solved</p>
          </div>
        </div>
        <div className="glass-card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary-light" />
          </div>
          <div>
            <p className="text-2xl font-bold">{sheets.length}</p>
            <p className="text-xs text-muted">Active sheets</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/sheets/new"
          className="glass-card p-6 group hover-glow transition-all duration-300 hover:border-primary/20 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition">
              <Sparkles className="h-6 w-6 text-primary-light" />
            </div>
            <div>
              <h3 className="font-semibold">Create New Sheet</h3>
              <p className="text-sm text-muted">Pick a company and duration</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted group-hover:text-primary-light transition" />
        </Link>
        <Link
          href="/search"
          className="glass-card p-6 group hover-glow transition-all duration-300 hover:border-accent/20 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold">Search Problems</h3>
              <p className="text-sm text-muted">Find any question by topic</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted group-hover:text-accent transition" />
        </Link>
      </div>

      {/* Recent Sheets */}
      {sheets.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Sheets</h2>
          <div className="space-y-3 stagger-children">
            {sheets.slice(0, 5).map((sheet: any) => (
              <Link
                key={sheet.id}
                href={`/sheets/${sheet.id}${sheet.is_personalized ? "?type=personalized" : ""}`}
                className="glass-card p-4 flex items-center justify-between group hover-glow transition-all duration-200 hover:border-primary/15 block"
              >
                <div>
                  <p className="font-medium">{sheet.company}</p>
                  <p className="text-xs text-muted">
                    {sheet.duration_days} days · {sheet.role} ·{" "}
                    <span className="capitalize">{sheet.completion_status?.replace("_", " ")}</span>
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-primary-light transition" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
