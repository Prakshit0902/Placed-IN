"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Save, User as UserIcon, Code2 } from "lucide-react";
import { getMe, updateProfile } from "@/lib/api";

export default function ProfileSettingsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [fullName, setFullName] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted mt-1">Manage your personal information and connected accounts.</p>
      </div>

      <div className="glass-card p-6 md:p-8">
        <form onSubmit={handleSave} className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted" />
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-surface border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              placeholder="e.g. Jane Doe"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted" />
              LeetCode Username
            </label>
            <input
              type="text"
              value={leetcodeUsername}
              onChange={(e) => setLeetcodeUsername(e.target.value)}
              className="w-full bg-surface border border-border/50 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              placeholder="e.g. janedoe_lc"
            />
            <p className="text-xs text-muted mt-1">
              Used to fetch your solved problems and personalize your study plans.
            </p>
          </div>

          <div className="pt-4 border-t border-border/30 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light transition-colors flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
