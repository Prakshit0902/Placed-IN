"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, BookOpen, Loader2, Calendar } from "lucide-react";
import { getMyCpSheets } from "@/lib/api";

export default function CpSheetsPage() {
  const { getToken } = useAuth();
  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await getMyCpSheets(token);
        if (res.success) {
          setSheets(res.data || []);
        }
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
        <Loader2 className="h-8 w-8 animate-spin text-primary-light" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My CP Sheets</h1>
          <p className="text-sm text-muted font-light mt-1">
            Custom problem sets generated from LeetCode and Codeforces.
          </p>
        </div>
        <Link
          href="/cp-sheets/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-sm w-fit"
        >
          <Plus className="h-4 w-4" /> New CP Sheet
        </Link>
      </div>

      {sheets.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center border border-border/50 rounded-2xl">
          <div className="h-12 w-12 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No CP Sheets yet</h3>
          <p className="text-sm text-muted max-w-sm mb-6">
            Create your first custom competitive programming sheet to start practicing across platforms.
          </p>
          <Link
            href="/cp-sheets/new"
            className="px-5 py-2.5 bg-primary/10 text-primary-light text-sm font-semibold rounded-xl hover:bg-primary/20 transition-all"
          >
            Create CP Sheet
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sheets.map((s) => (
            <Link
              key={s.id}
              href={`/cp-sheets/${s.id}`}
              className="glass-card p-5 border border-border/50 hover:border-border transition-all flex flex-col group rounded-2xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-surface-elevated rounded-xl">
                  <BookOpen className="h-5 w-5 text-foreground/80 group-hover:text-foreground transition-colors" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 bg-surface border border-border/50 rounded-full text-muted">
                  {s.target_level}
                </span>
              </div>
              <h3 className="font-semibold text-base mb-1 group-hover:text-primary-light transition-colors line-clamp-1">
                {s.sheet_name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-muted mb-4">
                <Calendar className="h-3.5 w-3.5" />
                <span>{s.duration_days} days plan</span>
              </div>
              <div className="mt-auto pt-4 border-t border-border/30 flex items-center justify-between text-xs font-medium text-muted">
                <span>Created {new Date(s.created_at).toLocaleDateString()}</span>
                <span className="capitalize">{s.completion_status.replace("_", " ")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
