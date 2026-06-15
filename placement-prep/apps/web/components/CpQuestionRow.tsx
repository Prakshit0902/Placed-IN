"use client";

import { useState } from "react";
import { ExternalLink, CheckCircle, Circle, Clock, Sparkles } from "lucide-react";
import { updateCpProgress } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import Link from "next/link";
import clsx from "clsx";

const AssistantDrawer = dynamic(() => import("./AssistantDrawer"), { ssr: false });

interface CpQuestionRowProps {
  problem: any;
  dayNumber: number;
  sheetId: string;
  onStatusChange?: (newStatus: string) => void;
}

export function CpQuestionRow({ problem, dayNumber, sheetId, onStatusChange }: CpQuestionRowProps) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState(problem.status || "not_started");
  const [updating, setUpdating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isLc = problem.platform === "leetcode";

  const toggleStatus = async () => {
    if (updating) return;
    const newStatus = status === "completed" ? "not_started" : "completed";
    setStatus(newStatus);
    setUpdating(true);

    try {
      const token = await getToken();
      if (!token) return;
      const probIdStr = isLc ? `lc_${problem.problem_id}` : `cf_${problem.problem_id}`;
      await updateCpProgress(sheetId, probIdStr, token, newStatus);
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
    } catch (error) {
      console.error(error);
      setStatus(status); // fallback revert
    } finally {
      setUpdating(false);
    }
  };

  const isCompleted = status === "completed";
  const linkUrl = isLc 
    ? `https://leetcode.com/problems/${problem.problem_slug}` 
    : problem.cf_url || `https://codeforces.com/problemset/problem/${problem.problem_id}`;

  return (
    <>
      <div
        className={clsx(
          "group flex items-center justify-between p-4 border-b border-border/40 hover:bg-surface-elevated/40 transition-all duration-200 select-none text-left",
          isCompleted && "opacity-60"
        )}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <button
            onClick={toggleStatus}
            disabled={updating}
            className="mt-1 flex-shrink-0 focus:outline-none cursor-pointer"
          >
            {isCompleted ? (
              <CheckCircle className="h-4.5 w-4.5 text-success transition-all scale-100 group-hover:scale-110" />
            ) : (
              <Circle className="h-4.5 w-4.5 text-muted hover:text-foreground transition-colors" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 flex-wrap">
              <Link
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                className={clsx(
                  "font-semibold text-sm hover:text-foreground transition-colors",
                  isCompleted ? "line-through text-muted font-normal" : "text-foreground/90"
                )}
              >
                {problem.problem_name}
              </Link>
              <a
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-foreground transition-colors inline-flex opacity-0 group-hover:opacity-100"
                title={`Open on ${isLc ? 'LeetCode' : 'Codeforces'}`}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 mt-2 font-mono text-[10px] text-muted">
              <span className="px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-surface border border-border">
                {problem.platform}
              </span>
              
              {isLc && problem.difficulty && (
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border",
                    problem.difficulty === "Easy"
                      ? "badge-easy"
                      : problem.difficulty === "Medium"
                      ? "badge-medium"
                      : "badge-hard"
                  )}
                >
                  {problem.difficulty}
                </span>
              )}
              
              {!isLc && problem.rating && (
                <span className="px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border border-purple-500/30 text-purple-400 bg-purple-500/10">
                  Rating {problem.rating}
                </span>
              )}

              {problem.status === "attempted" && !isCompleted && (
                <span className="px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
                  Attempted
                </span>
              )}
              
              <div className="flex items-center gap-1 font-sans font-light">
                <Clock className="h-3.5 w-3.5 text-muted shrink-0" />
                <span>
                  {isLc 
                    ? (problem.difficulty === "Easy" ? "20m" : problem.difficulty === "Medium" ? "45m" : "90m")
                    : (problem.rating && problem.rating < 1200 ? "30m" : problem.rating && problem.rating < 1600 ? "45m" : "90m")
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            title="Open AI Assistant"
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border hover:border-foreground/35 bg-surface-elevated/40 text-foreground hover:bg-surface-elevated/80 transition-all duration-200 hover:scale-105 flex-shrink-0 cursor-pointer"
          >
            <Sparkles className="h-3 w-3 text-muted" /> AI
          </button>
        </div>
      </div>

      <AssistantDrawer
        problem={
          drawerOpen
            ? {
                id: problem.problem_id,
                title: problem.problem_name,
                difficulty: isLc ? problem.difficulty : problem.rating?.toString(),
                topic_tags: [],
                platform: isLc ? 'leetcode' : 'codeforces'
              }
            : null
        }
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
