"use client";

import { useEffect, useState, FormEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, BookOpen, BrainCircuit, ShieldCheck } from "lucide-react";
import { getCompanies, generatePersonalizedSheet, generateDeepPersonalizedSheet, syncLeetcodeData, syncLeetcodeRawChunk, syncLeetcodeAggregate, getLeetcodeSyncStatus } from "@/lib/api";

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

  useEffect(() => {
    if (type === 'deep' && !syncMetadata && !loadingSyncMeta) {
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
         } catch(e) {
           console.error(e);
         } finally {
           setLoadingSyncMeta(false);
         }
      };
      loadMeta();
    }
  }, [type, getToken]);

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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4 mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Create Study Plan</h1>
        <p className="text-muted max-w-xl mx-auto">
          Select your target company and timeline. Choose standard for a generic plan, or personalized to focus on your weak areas using AI.
        </p>
      </div>

      <div className="glass-card p-6 md:p-10 border border-border/50 max-w-2xl mx-auto relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="space-y-8">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Target Company</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none"
              >
                <option value="" disabled>Select a company...</option>
                {companies.map((c) => (
                  <option key={c.company} value={c.company}>
                    {c.company} ({c.count} questions)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Prep Duration</label>
              <div className="grid grid-cols-3 gap-3">
                {[30, 60, 90].map((days) => (
                  <div
                    key={days}
                    onClick={() => setDuration(days.toString())}
                    className={`cursor-pointer rounded-xl border p-4 text-center transition-all ${
                      duration === days.toString()
                        ? "border-primary bg-primary/10 text-primary-light"
                        : "border-border/50 hover:bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    <p className="font-semibold">{days}</p>
                    <p className="text-xs">Days</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Plan Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div
                  onClick={() => setType("standard")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    type === "standard"
                      ? "border-foreground bg-surface-elevated text-foreground"
                      : "border-border/50 hover:border-border text-muted"
                  }`}
                >
                  <BookOpen className={`h-6 w-6 mb-3 ${type === "standard" ? "text-foreground" : "text-muted"}`} />
                  <h3 className="font-medium mb-1">Standard</h3>
                  <p className="text-xs opacity-80">Generic topics.</p>
                </div>

                <div
                  onClick={() => setType("personalized")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all relative overflow-hidden ${
                    type === "personalized"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border/50 hover:border-primary/50 text-muted"
                  }`}
                >
                  <BrainCircuit className={`h-6 w-6 mb-3 ${type === "personalized" ? "text-primary-light" : "text-muted"}`} />
                  <h3 className="font-medium mb-1">AI Basic</h3>
                  <p className="text-xs opacity-80">Profile based.</p>
                </div>

                <div
                  onClick={() => setType("deep")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all relative overflow-hidden ${
                    type === "deep"
                      ? "border-purple-500 bg-purple-500/10 text-foreground"
                      : "border-border/50 hover:border-purple-500/50 text-muted"
                  }`}
                >
                  {type === "deep" && (
                    <div className="absolute top-0 right-0 p-1.5 bg-purple-500/20 rounded-bl-lg">
                      <Sparkles className="h-3 w-3 text-purple-400" />
                    </div>
                  )}
                  <ShieldCheck className={`h-6 w-6 mb-3 ${type === "deep" ? "text-purple-400" : "text-muted"}`} />
                  <h3 className="font-medium mb-1">AI Deep Sync</h3>
                  <p className="text-xs opacity-80">Extension sync (Paid).</p>
                </div>
              </div>
              
              {type === "deep" && (
                <div className="mt-4 p-4 rounded-lg bg-surface border border-purple-500/30 text-sm flex flex-col items-start gap-2">
                  <p className="text-foreground">
                    Deep Sync requires the PlacementPrep Chrome Extension. Before syncing: (1) log in at{" "}
                    <a href="https://leetcode.com/problemset/" target="_blank" rel="noreferrer" className="text-purple-400 underline hover:text-purple-300 transition-colors">
                      leetcode.com/problemset
                    </a>
                    , (2) reload the extension at chrome://extensions, (3) refresh the LeetCode tab, then sync.
                  </p>

                  <div className="w-full mt-2 mb-2 space-y-2">
                    {loadingSyncMeta ? (
                      <p className="text-sm text-muted animate-pulse">Loading sync status...</p>
                    ) : syncMetadata?.sync_level ? (
                      <div className="space-y-3">
                        <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg text-sm text-purple-300">
                          <span className="font-semibold">Last Sync: </span>
                          {syncMetadata.sync_level === 'all_time' ? 'All Time Data' : syncMetadata.sync_level === '1_year' ? '1 Year Data' : '6 Months Data'}
                          {syncMetadata.last_synced_at && ` on ${new Date(syncMetadata.last_synced_at).toLocaleDateString()}`}
                        </div>
                        {syncMetadata.sync_level !== 'all_time' && (
                          <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">Upgrade Sync Timeframe (Optional)</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {syncMetadata.sync_level === '6_months' && (
                                <div 
                                  onClick={() => setSyncTimeframe("1_year")}
                                  className={`cursor-pointer rounded-xl border p-3 transition-all duration-300 relative overflow-hidden ${syncTimeframe === "1_year" ? "border-purple-500 bg-purple-500/10 text-foreground scale-[1.02] shadow-sm" : "border-border/50 hover:border-purple-500/30 text-muted hover:bg-surface-elevated"}`}
                                >
                                  <h4 className="font-semibold text-sm flex items-center gap-1">Standard Sync</h4>
                                  <p className="text-xs opacity-80 mt-1">Upgrade to 1 Year.</p>
                                </div>
                              )}
                              <div 
                                onClick={() => setSyncTimeframe("all_time")}
                                className={`cursor-pointer rounded-xl border p-3 transition-all duration-300 relative overflow-hidden ${syncTimeframe === "all_time" ? "border-purple-500 bg-purple-500/10 text-foreground scale-[1.02] shadow-sm" : "border-border/50 hover:border-purple-500/30 text-muted hover:bg-surface-elevated"}`}
                              >
                                <h4 className="font-semibold text-sm flex items-center gap-1">All Time</h4>
                                <p className="text-xs opacity-80 mt-1">Upgrade to Complete History.</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <label className="text-sm font-medium text-foreground">Sync Timeframe</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div 
                            onClick={() => setSyncTimeframe("6_months")}
                            className={`cursor-pointer rounded-xl border p-3 transition-all duration-300 relative overflow-hidden ${syncTimeframe === "6_months" ? "border-purple-500 bg-purple-500/10 text-foreground scale-[1.02] shadow-sm" : "border-border/50 hover:border-purple-500/30 text-muted hover:bg-surface-elevated"}`}
                          >
                            <h4 className="font-semibold text-sm flex items-center gap-1">Quick Sync</h4>
                            <p className="text-xs opacity-80 mt-1">6 Months. Fastest, focuses on recent performance trends.</p>
                          </div>
                          <div 
                            onClick={() => setSyncTimeframe("1_year")}
                            className={`cursor-pointer rounded-xl border p-3 transition-all duration-300 relative overflow-hidden ${syncTimeframe === "1_year" ? "border-purple-500 bg-purple-500/10 text-foreground scale-[1.02] shadow-sm" : "border-border/50 hover:border-purple-500/30 text-muted hover:bg-surface-elevated"}`}
                          >
                            <h4 className="font-semibold text-sm flex items-center gap-1">Standard Sync</h4>
                            <p className="text-xs opacity-80 mt-1">1 Year. Balanced, captures the complete annual prep cycle.</p>
                          </div>
                          <div 
                            onClick={() => setSyncTimeframe("all_time")}
                            className={`cursor-pointer rounded-xl border p-3 transition-all duration-300 relative overflow-hidden ${syncTimeframe === "all_time" ? "border-purple-500 bg-purple-500/10 text-foreground scale-[1.02] shadow-sm" : "border-border/50 hover:border-purple-500/30 text-muted hover:bg-surface-elevated"}`}
                          >
                            <h4 className="font-semibold text-sm flex items-center gap-1">All Time</h4>
                            <p className="text-xs opacity-80 mt-1">Complete History. Most reliable profile, takes longer.</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button 
                    type="button"
                    disabled={syncing}
                    onClick={async () => {
                      const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
                      if (!extensionId) {
                         alert("Extension ID is missing. Please set NEXT_PUBLIC_EXTENSION_ID in your .env.local without quotes.");
                         return;
                      }

                      try {
                        if (!window.chrome || !window.chrome.runtime) {
                          alert("Please use Google Chrome or a Chromium-based browser with the extension installed.");
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
                            alert("Extension error: " + msg.message);
                            port.disconnect();
                          } else if (msg.type === "PROBLEMS") {
                            const problems = msg.problems || [];
                            setSyncStats(prev => ({ ...prev, problems: problems.length }));
                            
                            const p = (async () => {
                              try {
                                const token = await getToken();
                                if (!token) throw new Error("Not authenticated");
                                if (problems.length > 0) {
                                  await syncLeetcodeData(token, { problems });
                                }
                              } catch (e) {
                                console.error("Failed to sync initial problems list", e);
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
                                console.error("Failed to upload chunk", e);
                              }
                            })();
                            chunkPromises.push(p);
                          } else if (msg.type === "COMPLETE") {
                            try {
                              setSyncStatus("Waiting for data to finish saving...");
                              await Promise.all(chunkPromises);

                              const token = await getToken();
                              if (!token) throw new Error("Not authenticated");
                              
                              setSyncStatus(`Computing mastery profiles from your submission history...`);
                              
                              const syncRes = await syncLeetcodeAggregate(token, syncTimeframe);
                              if (syncRes.success) {
                                setSyncStatus(syncRes.message);
                                alert("Deep Sync successful! " + syncRes.message);
                              } else {
                                setSyncStatus(null);
                                alert("Failed to compute stats on backend.");
                              }
                            } catch (e: any) {
                              setSyncStatus(null);
                              alert("Error completing sync: " + e.message);
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
                        if (err.message?.includes("Invalid extension id")) {
                          alert("Invalid extension ID format. Please make sure there are NO quotes in your .env.local file. Example: NEXT_PUBLIC_EXTENSION_ID=jmocmkpobeiebdinnbpinnodgbieekah");
                        } else {
                          alert("Error contacting extension: " + err.message);
                        }
                      }
                    }}
                    className="mt-2 px-4 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-medium rounded-lg transition-colors border border-purple-500/50 text-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {syncing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Deep Syncing…</>
                    ) : (
                      "Start Deep Sync via Extension"
                    )}
                  </button>
                  {syncStatus && (
                    <div className="w-full mt-2">
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="bg-surface border border-border/50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-foreground">{syncStats.problems}</p>
                          <p className="text-[10px] text-muted">Problems Found</p>
                        </div>
                        <div className="bg-surface border border-border/50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-blue-400">{syncStats.fetched}</p>
                          <p className="text-[10px] text-muted">Fetched Subs</p>
                        </div>
                        <div className="bg-surface border border-border/50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-green-400">{syncStats.uploaded}</p>
                          <p className="text-[10px] text-muted">Uploaded Subs</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted font-medium">{syncStatus}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border/30">
              <button
                type="submit"
                disabled={generating || !company}
                className={`w-full py-4 text-white rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  type === "deep" ? "bg-purple-500 hover:bg-purple-400" : "bg-primary hover:bg-primary-light"
                }`}
              >
                {generating ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Generating Plan...</>
                ) : (
                  <>Create Plan <Sparkles className="h-5 w-5" /></>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
