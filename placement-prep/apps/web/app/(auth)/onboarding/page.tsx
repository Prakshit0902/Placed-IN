"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, Code2, ArrowRight, Sparkles } from "lucide-react";
import { setLeetcodeUsername } from "@/lib/api";
import Link from "next/link";

export default function OnboardingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication session expired.");
      
      const res = await setLeetcodeUsername(token, username.trim());
      if (res.success) {
        router.push("/dashboard");
      } else {
        throw new Error("Failed to save username.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update username. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-md p-6 md:p-8 glass-card animate-fade-in space-y-6">
        {/* Logo/Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary-light animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to <span className="gradient-text">PrepAssist</span> 👋
            </h1>
            <p className="text-sm text-muted">
              Let&apos;s link your LeetCode account to start personalizing your prep sheets.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted" />
              LeetCode Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-surface border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder-muted/50 text-foreground"
              placeholder="e.g. leetcode_user"
              disabled={saving}
            />
            <p className="text-xs text-muted">
              We use this to analyze your stats and adjust sheet recommendations.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !username.trim()}
            className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue to Dashboard
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Skip action */}
        <div className="text-center pt-2">
          <Link
            href="/dashboard"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Skip for now (configure later in Settings)
          </Link>
        </div>
      </div>
    </div>
  );
}
