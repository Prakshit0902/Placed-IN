"use client";

import { useEffect, useState, FormEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, BookOpen, BrainCircuit, ShieldCheck } from "lucide-react";
import { getCompanies, generatePersonalizedSheet, generateDeepPersonalizedSheet, syncLeetcodeData } from "@/lib/api";

export default function NewSheetPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  
  const [company, setCompany] = useState("");
  const [duration, setDuration] = useState("30");
  const [type, setType] = useState<"standard" | "personalized" | "deep">("standard");

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
                    <a href="https://leetcode.com/problemset/" target="_blank" rel="noreferrer" className="text-purple-400 underline">
                      leetcode.com/problemset
                    </a>
                    , (2) reload the extension at chrome://extensions, (3) refresh the LeetCode tab, then sync.
                  </p>
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
                        setSyncStatus("Fetching solved problems from LeetCode…");
                        
                        window.chrome.runtime.sendMessage(extensionId, { action: "GET_SOLVED_PROBLEMS" }, async (response) => {
                          if (window.chrome.runtime.lastError) {
                             setSyncing(false);
                             setSyncStatus(null);
                             alert("Please install/enable the PlacementPrep extension. Ensure the NEXT_PUBLIC_EXTENSION_ID matches the one in chrome://extensions.");
                             return;
                          }
                          
                          if (response && !response.success) {
                             setSyncing(false);
                             setSyncStatus(null);
                             alert("Extension error: " + (response?.error || "Unknown"));
                             return;
                          }

                          if (response && response.success) {
                            try {
                                const token = await getToken();
                                if (!token) throw new Error("Not authenticated");

                                const problems = Array.isArray(response.problems) ? response.problems : [];
                                const slugs = Array.isArray(response.slugs) ? response.slugs : [];
                                const count = problems.length || slugs.length;

                                if (count === 0) {
                                  throw new Error(
                                    response?.error ||
                                      "No solved problems found. Open leetcode.com/problemset while logged in, refresh that tab, reload the extension, then sync again."
                                  );
                                }

                                setSyncStatus(`Uploading ${count} problems to your profile…`);

                                const syncRes =
                                  problems.length > 0
                                    ? await syncLeetcodeData(token, { problems })
                                    : await syncLeetcodeData(token, { solved_slugs: slugs });
                                if (syncRes.success) {
                                   setSyncStatus(syncRes.message);
                                   alert("Sync successful! " + syncRes.message);
                                } else {
                                   setSyncStatus(null);
                                   alert("Failed to sync to backend.");
                                }
                            } catch (e: any) {
                                setSyncStatus(null);
                                alert("Error syncing to backend: " + e.message);
                            } finally {
                              setSyncing(false);
                            }
                          } else {
                             setSyncing(false);
                             setSyncStatus(null);
                             alert("No response from extension. Reload it at chrome://extensions and try again.");
                          }
                        });
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
                      <><Loader2 className="h-4 w-4 animate-spin" /> Syncing…</>
                    ) : (
                      "Sync Solved Problems via Extension"
                    )}
                  </button>
                  {syncStatus && (
                    <p className="text-xs text-muted mt-1">{syncStatus}</p>
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
