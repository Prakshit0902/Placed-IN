"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Save, User as UserIcon, Code2 } from "lucide-react";
import { getMe, updateProfile } from "@/lib/api";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export default function ProfileSettingsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [fullName, setFullName] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [cfUsername, setCfUsername] = useState("");
  const [syncingCf, setSyncingCf] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch profile data
  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await getMe(token);
        if (res.success && res.data) {
          setUser(res.data);
          setFullName(res.data.full_name || "");
          setLeetcodeUsername(res.data.leetcode_username || "");
          setCfUsername(res.data.cf_username || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await updateProfile(token, {
        full_name: fullName,
        leetcode_username: leetcodeUsername,
        cf_username: cfUsername,
      });
      if (res.success) {
        alert("Profile updated successfully!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncCf = async () => {
    if (!cfUsername) {
      alert("Please save your Codeforces username first before syncing.");
      return;
    }
    setSyncingCf(true);
    try {
      const token = await getToken();
      if (!token) return;
      const { syncCodeforcesData } = await import("@/lib/api");
      const res = await syncCodeforcesData(token);
      if (res.success) {
        alert(res.message || "Codeforces data synced successfully!");
      } else {
        alert("Failed to sync Codeforces data.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to sync Codeforces data.");
    } finally {
      setSyncingCf(false);
    }
  };

  // GSAP animations
  useGSAP(() => {
    if (loading) return;

    // 1. Header fade-down
    gsap.fromTo(
      ".settings-header",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );

    // 2. Settings form segments stagger
    gsap.fromTo(
      ".form-field-anim",
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: "power2.out", delay: 0.1 }
    );
  }, { scope: containerRef, dependencies: [loading] });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-light" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-3xl mx-auto space-y-6 text-foreground">
      {/* Header */}
      <div className="settings-header border-b border-border/40 pb-6 text-left">
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-sm text-muted font-light mt-1">
          Manage your personal identifiers and LeetCode connection details.
        </p>
      </div>

      <div className="glass-card p-6 md:p-8 border border-border/50 form-field-anim">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Full Name */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted flex items-center gap-2 select-none">
              <UserIcon className="h-4 w-4 text-muted" />
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-surface/30 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-all text-foreground placeholder:text-muted/50"
              placeholder="e.g. Jane Doe"
            />
          </div>

          {/* LeetCode Username */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted flex items-center gap-2 select-none">
              <Code2 className="h-4 w-4 text-muted" />
              LeetCode Username
            </label>
            <input
              type="text"
              value={leetcodeUsername}
              onChange={(e) => setLeetcodeUsername(e.target.value)}
              className="w-full bg-surface/30 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-all text-foreground placeholder:text-muted/50"
              placeholder="e.g. janedoe_lc"
            />
            <p className="text-[10px] text-muted font-light mt-1 pl-1 select-none">
              Connecting LeetCode unlocks automated progress synchronizations.
            </p>
          </div>

          {/* Codeforces Username */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted flex items-center gap-2 select-none">
              <Code2 className="h-4 w-4 text-muted" />
              Codeforces Username
            </label>
            <div className="flex gap-3 items-start">
              <input
                type="text"
                value={cfUsername}
                onChange={(e) => setCfUsername(e.target.value)}
                className="w-full bg-surface/30 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-all text-foreground placeholder:text-muted/50"
                placeholder="e.g. tourist"
              />
              <button
                type="button"
                onClick={handleSyncCf}
                disabled={syncingCf || !cfUsername}
                className="px-4 py-3 bg-primary/10 text-primary-light text-sm font-semibold rounded-xl hover:bg-primary/20 disabled:opacity-50 transition-all whitespace-nowrap flex items-center gap-2"
              >
                {syncingCf ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {syncingCf ? "Syncing..." : "Sync CF"}
              </button>
            </div>
            <p className="text-[10px] text-muted font-light mt-1 pl-1 select-none">
              Save your username first, then sync Codeforces submissions manually.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border/30 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-foreground text-background text-xs font-semibold tracking-wide rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
