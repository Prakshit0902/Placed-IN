"use client";

import { useEffect, useState, FormEvent, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  BookOpen,
  BrainCircuit,
  ShieldCheck,
  Building2,
  CalendarDays,
  FileText,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import {
  getCompanies,
  generatePersonalizedSheet,
  generateDeepPersonalizedSheet,
  syncLeetcodeData,
  syncLeetcodeRawChunk,
  syncLeetcodeAggregate,
  getLeetcodeSyncStatus,
} from "@/lib/api";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";

export default function NewSheetPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState({ problems: 0, fetched: 0, uploaded: 0 });
  
  const [company, setCompany] = useState("");
  const [duration, setDuration] = useState("30");
  const [type, setType] = useState<"standard" | "personalized" | "deep">("standard");
  const [syncTimeframe, setSyncTimeframe] = useState<"6_months" | "1_year" | "all_time">("1_year");
  const [syncMetadata, setSyncMetadata] = useState<any>(null);
  const [loadingSyncMeta, setLoadingSyncMeta] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Magnetic button helpers
  const handleMagneticMove = (e: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    el.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
    el.style.setProperty("--bx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--by", `${e.clientY - rect.top}px`);
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
    const el = e.currentTarget;
    el.style.transform = "translate(0, 0)";
  };

  // Fetch target companies
  useEffect(() => {
    async function load() {
      try {
        const res = await getCompanies();
        if (res.success && res.data) {
          setCompanies(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Fetch extension sync status for deep sync plan
  useEffect(() => {
    if (type === "deep" && !syncMetadata && !loadingSyncMeta) {
      const loadMeta = async () => {
        setLoadingSyncMeta(true);
        try {
          const token = await getToken();
          if (token) {
            const res = await getLeetcodeSyncStatus(token);
            if (res.success) {
              setSyncMetadata(res);
              if (res.sync_level) {
                setSyncTimeframe(res.sync_level as any);
              }
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingSyncMeta(false);
        }
      };
      loadMeta();
    }
  }, [type, getToken, syncMetadata, loadingSyncMeta]);

  // Submit generate plan trigger
  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;

    if (type === "standard") {
      router.push(`/sheets/${company.toLowerCase()}_sde_${duration}day`);
    } else {
      setGenerating(true);
      try {
        const token = await getToken();
        if (!token) {
          router.push("/sign-up");
          return;
        }

        let res;
        if (type === "deep") {
          res = await generateDeepPersonalizedSheet(token, {
            company,
            duration_days: parseInt(duration),
          });
        } else {
          res = await generatePersonalizedSheet(token, {
            company,
            duration_days: parseInt(duration),
          });
        }
        
        if (res.success && res.data) {
          router.push(`/sheets/${res.data.id}?type=${type}`);
        } else {
          alert("Failed to generate personalized sheet.");
        }
      } catch (err: any) {
        if (err.message.includes("403") || err.message.includes("premium")) {
          alert("Premium subscription required for AI personalization.");
          router.push("/settings/billing");
        } else {
          console.error(err);
          alert("Error generating sheet.");
        }
      } finally {
        setGenerating(false);
      }
    }
  };

  // GSAP Entrance timeline on load
  useGSAP(() => {
    if (loading) return;

    gsap.fromTo(
      ".form-step-anim",
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power2.out" }
    );
  }, { scope: containerRef, dependencies: [loading] });

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto space-y-6 text-foreground">
      {/* Glow Effect */}
      <div className="absolute -top-32 -right-32 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="dashboard-header border-b border-border/40 pb-6 text-left">
        <h1 className="text-2xl font-bold tracking-tight">Create Study Plan</h1>
        <p className="text-sm text-muted font-light mt-1">
          Select a target tech firm and timeline. Leverage AI personalization to automatically prioritize your weak areas.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary-light" />
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left / Center Grid Form Options */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Target Company */}
            <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                <Building2 className="h-4 w-4 text-muted" />
                <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                  1. Target Company
                </h3>
              </div>
              <div className="relative">
                <select
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  className="w-full bg-surface border border-border/50 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all appearance-none text-foreground cursor-pointer"
                >
                  <option value="" disabled>Select target company...</option>
                  {companies.map((c) => (
                    <option key={c.company} value={c.company}>
                      {c.company} ({c.count} questions)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              </div>
            </div>

            {/* Step 2: Plan Type */}
            <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                <Sparkles className="h-4 w-4 text-muted" />
                <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                  2. Personalization Level
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Standard */}
                <div
                  onClick={() => setType("standard")}
                  className={clsx(
                    "cursor-pointer rounded-xl border p-4 transition-all duration-300 relative group flex flex-col justify-between min-h-[140px]",
                    type === "standard"
                      ? "border-foreground bg-surface-elevated text-foreground"
                      : "border-border/50 bg-surface/20 text-muted hover:border-border hover:text-foreground"
                  )}
                >
                  <BookOpen className="h-5 w-5 mb-2 transition-transform group-hover:scale-110" />
                  <div>
                    <h4 className="font-semibold text-sm">Standard Plan</h4>
                    <p className="text-[11px] opacity-80 mt-1 leading-relaxed">
                      Generic curation based on frequency weights.
                    </p>
                  </div>
                </div>

                {/* AI Basic */}
                <div
                  onClick={() => setType("personalized")}
                  className={clsx(
                    "cursor-pointer rounded-xl border p-4 transition-all duration-300 relative group flex flex-col justify-between min-h-[140px]",
                    type === "personalized"
                      ? "border-foreground bg-surface-elevated text-foreground"
                      : "border-border/50 bg-surface/20 text-muted hover:border-border hover:text-foreground"
                  )}
                >
                  <BrainCircuit className="h-5 w-5 mb-2 transition-transform group-hover:scale-110" />
                  <div>
                    <h4 className="font-semibold text-sm">Basic AI Sync</h4>
                    <p className="text-[11px] opacity-80 mt-1 leading-relaxed">
                      Calibrates plan using Leetcode profile solved counts.
                    </p>
                  </div>
                </div>

                {/* AI Deep Sync */}
                <div
                  onClick={() => setType("deep")}
                  className={clsx(
                    "cursor-pointer rounded-xl border p-4 transition-all duration-300 relative group flex flex-col justify-between min-h-[140px]",
                    type === "deep"
                      ? "border-foreground bg-surface-elevated text-foreground"
                      : "border-border/50 bg-surface/20 text-muted hover:border-border hover:text-foreground"
                  )}
                >
                  <ShieldCheck className="h-5 w-5 mb-2 transition-transform group-hover:scale-110" />
                  <div>
                    <h4 className="font-semibold text-sm">Deep Sync AI</h4>
                    <p className="text-[11px] opacity-80 mt-1 leading-relaxed">
                      Analyzes complete submission timeline history.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Deep Sync Panel (Only visible if Deep Sync AI selected) */}
            {type === "deep" && (
              <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
                <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                  <ShieldCheck className="h-4 w-4 text-muted" />
                  <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                    Deep Sync Workspace
                  </h3>
                </div>

                <div className="text-xs text-muted leading-relaxed space-y-2">
                  <p>
                    Deep Sync connects securely using the <span className="font-semibold text-foreground">PlacementPrep Chrome Extension</span>. 
                  </p>
                  <p className="pl-3 border-l border-border/60">
                    Ensure you are logged in to LeetCode, reload the extension runtime, and keep the sync process active.
                  </p>
                </div>

                {/* Timeframe selection */}
                <div className="space-y-3 pt-2">
                  {loadingSyncMeta ? (
                    <div className="flex items-center gap-2 text-xs text-muted animate-pulse">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading synced records...
                    </div>
                  ) : syncMetadata?.sync_level ? (
                    <div className="flex flex-col gap-2">
                      <div className="bg-surface-elevated/40 border border-border/60 px-4 py-2.5 rounded-xl text-xs text-muted">
                        <span className="font-medium text-foreground">Last Synced Level: </span>
                        {syncMetadata.sync_level === "all_time" ? "All Time" : syncMetadata.sync_level === "1_year" ? "1 Year" : "6 Months"}
                        {syncMetadata.last_synced_at && ` on ${new Date(syncMetadata.last_synced_at).toLocaleDateString()}`}
                      </div>

                      {syncMetadata.sync_level !== "all_time" && (
                        <div className="space-y-2 mt-2">
                          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Upgrade Sync Window</span>
                          <div className="grid grid-cols-2 gap-3">
                            {syncMetadata.sync_level === "6_months" && (
                              <div
                                onClick={() => setSyncTimeframe("1_year")}
                                className={clsx(
                                  "cursor-pointer rounded-xl border p-3 text-center transition-all",
                                  syncTimeframe === "1_year" ? "border-foreground bg-surface-elevated text-foreground" : "border-border/50 text-muted"
                                )}
                              >
                                <span className="text-xs font-semibold block">1 Year</span>
                              </div>
                            )}
                            <div
                              onClick={() => setSyncTimeframe("all_time")}
                              className={clsx(
                                "cursor-pointer rounded-xl border p-3 text-center transition-all",
                                syncTimeframe === "all_time" ? "border-foreground bg-surface-elevated text-foreground" : "border-border/50 text-muted"
                              )}
                            >
                              <span className="text-xs font-semibold block">All Time</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Sync Depth Timeframe</span>
                      <div className="grid grid-cols-3 gap-3">
                        {(["6_months", "1_year", "all_time"] as const).map((time) => (
                          <div
                            key={time}
                            onClick={() => setSyncTimeframe(time)}
                            className={clsx(
                              "cursor-pointer rounded-xl border p-3 text-center transition-all duration-200",
                              syncTimeframe === time ? "border-foreground bg-surface-elevated text-foreground" : "border-border/50 text-muted hover:border-border/80"
                            )}
                          >
                            <span className="text-xs font-semibold capitalize block">
                              {time.replace("_", " ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={async () => {
                      const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
                      if (!extensionId) {
                        alert("Extension ID is missing. Set NEXT_PUBLIC_EXTENSION_ID in .env.local");
                        return;
                      }

                      try {
                        if (!window.chrome || !window.chrome.runtime) {
                          alert("Google Chrome with PlacementPrep extension installed is required.");
                          return;
                        }

                        setSyncing(true);
                        setSyncStats({ problems: 0, fetched: 0, uploaded: 0 });
                        let chunkPromises: Promise<void>[] = [];
                        
                        const port = window.chrome.runtime.connect(extensionId, { name: "DEEP_SYNC" });
                        
                        port.onMessage.addListener(async (msg) => {
                          if (msg.type === "PROGRESS") {
                            setSyncStatus(msg.message);
                          } else if (msg.type === "ERROR") {
                            setSyncing(false);
                            setSyncStatus(null);
                            alert("Sync failed: " + msg.message);
                            port.disconnect();
                          } else if (msg.type === "PROBLEMS") {
                            const problems = msg.problems || [];
                            setSyncStats(prev => ({ ...prev, problems: problems.length }));
                            
                            const p = (async () => {
                              try {
                                const token = await getToken();
                                if (!token) throw new Error("Unauthenticated");
                                if (problems.length > 0) {
                                  await syncLeetcodeData(token, { problems });
                                }
                              } catch (e) {
                                console.error("Initial sync error", e);
                              }
                            })();
                            chunkPromises.push(p);
                          } else if (msg.type === "CHUNK") {
                            const subs = msg.submissions || [];
                            setSyncStats(prev => ({ ...prev, fetched: prev.fetched + subs.length }));
                            
                            const p = (async () => {
                              try {
                                const token = await getToken();
                                if (token && subs.length > 0) {
                                  await syncLeetcodeRawChunk(token, subs);
                                  setSyncStats(prev => ({ ...prev, uploaded: prev.uploaded + subs.length }));
                                }
                              } catch (e) {
                                console.error("Chunk sync error", e);
                              }
                            })();
                            chunkPromises.push(p);
                          } else if (msg.type === "COMPLETE") {
                            try {
                              setSyncStatus("Finalizing local data profiles...");
                              await Promise.all(chunkPromises);

                              const token = await getToken();
                              if (!token) throw new Error("Unauthenticated");
                              
                              setSyncStatus("Aggregating submission heatmaps...");
                              const syncRes = await syncLeetcodeAggregate(token, syncTimeframe);
                              if (syncRes.success) {
                                setSyncStatus(syncRes.message);
                                alert("Data synchronized successfully!");
                              } else {
                                setSyncStatus(null);
                                alert("Backend compilation failed.");
                              }
                            } catch (e: any) {
                              setSyncStatus(null);
                              alert("Aggregation compilation failed: " + e.message);
                            } finally {
                              setSyncing(false);
                              port.disconnect();
                            }
                          }
                        });
                        
                        port.postMessage({ action: "START", timeframe: syncTimeframe, syncStatus: syncMetadata });
                      } catch (err: any) {
                        setSyncing(false);
                        setSyncStatus(null);
                        alert("Extension connection failed: " + err.message);
                      }
                    }}
                    className="w-fit px-4 py-2 border border-border/80 bg-surface hover:bg-surface-elevated/85 transition-all text-xs font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {syncing ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...</>
                    ) : (
                      "Start Chrome Extension Sync"
                    )}
                  </button>

                  {/* Sync status logs */}
                  {syncStatus && (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-surface p-3 border border-border/50 rounded-xl text-center">
                          <p className="text-lg font-bold font-mono text-foreground">{syncStats.problems}</p>
                          <p className="text-[10px] text-muted uppercase">Solved Problems</p>
                        </div>
                        <div className="bg-surface p-3 border border-border/50 rounded-xl text-center">
                          <p className="text-lg font-bold font-mono text-blue-400">{syncStats.fetched}</p>
                          <p className="text-[10px] text-muted uppercase">Fetched</p>
                        </div>
                        <div className="bg-surface p-3 border border-border/50 rounded-xl text-center">
                          <p className="text-lg font-bold font-mono text-success">{syncStats.uploaded}</p>
                          <p className="text-[10px] text-muted uppercase">Synced</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted font-medium italic">{syncStatus}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar Form Config (30% / 1 col) */}
          <div className="space-y-6">
            
            {/* Step 3: Duration */}
            <div className="glass-card p-5 border border-border/50 form-step-anim space-y-4 text-left">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                <CalendarDays className="h-4 w-4 text-muted" />
                <h3 className="text-[13px] uppercase tracking-widest font-medium text-muted">
                  3. Timeline Duration
                </h3>
              </div>

              <div className="flex flex-col gap-3">
                {[30, 60, 90].map((days) => (
                  <div
                    key={days}
                    onClick={() => setDuration(days.toString())}
                    className={clsx(
                      "cursor-pointer rounded-xl border p-4 transition-all duration-200 text-center flex items-center justify-between group",
                      duration === days.toString()
                        ? "border-foreground bg-surface-elevated text-foreground"
                        : "border-border/50 text-muted hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-baseline gap-1 text-left">
                      <span className="text-2xl font-bold font-mono group-hover:scale-105 transition-transform">
                        {days}
                      </span>
                      <span className="text-xs">days</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-widest opacity-80">
                      {days === 30 ? "Sprint" : days === 60 ? "Standard" : "Deep Dive"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4: Submission CTA */}
            <div className="form-step-anim">
              <button
                type="submit"
                disabled={generating || !company}
                className={clsx(
                  "w-full py-4 text-sm font-semibold rounded-xl transition-all duration-300 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50",
                  type === "deep" ? "bg-purple-500 hover:bg-purple-400 text-white" : "bg-foreground text-background hover:opacity-90"
                )}
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Compiling Plan...</>
                ) : (
                  <>Create study plan <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>

          </div>
        </form>
      )}
    </div>
  );
}
