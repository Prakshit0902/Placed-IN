"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ExternalLink,
  ChevronLeft,
  Loader2,
  Tag,
  Zap,
  BookOpen,
  Code2,
  Lightbulb,
  CheckCircle,
  Clock,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { getProblemById } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";

const AssistantDrawer = dynamic(() => import("@/components/AssistantDrawer"), { ssr: false });

const LANG_LABELS: Record<string, string> = {
  python: "Python",
  java: "Java",
  cpp: "C++",
  javascript: "JS",
  typescript: "TS",
  go: "Go",
  rust: "Rust",
  csharp: "C#",
  kotlin: "Kotlin",
};

export default function ProblemViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { isSignedIn } = useAuth();
  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [activeHintIdx, setActiveHintIdx] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch problem details by ID
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProblemById(Number(id))
      .then((res) => {
        if (res.success) setProblem(res.data);
        else setError("Problem not found");
      })
      .catch(() => setError("Failed to load problem"))
      .finally(() => setLoading(false));
  }, [id]);

  // GSAP animations
  useGSAP(() => {
    if (loading || error || !problem) return;

    // 1. Top navigation fade-down
    gsap.fromTo(
      ".nav-bar-anim",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
    );

    // 2. Left pane fade-up
    gsap.fromTo(
      ".left-pane-anim",
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.08 }
    );

    // 3. Right pane stagger slide-up
    gsap.fromTo(
      ".right-pane-anim",
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power2.out", delay: 0.12 }
    );

  }, { scope: containerRef, dependencies: [loading, error, problem] });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-light" />
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="text-center py-20 select-none">
        <p className="text-muted text-sm font-light">{error || "Problem not found"}</p>
        <Link
          href="/search"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted hover:text-foreground transition-all"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Search
        </Link>
      </div>
    );
  }

  const hints: string[] = problem.hints || [];
  const testCases: string[] = (problem.example_testcases || "").trim().split("\n\n").filter(Boolean);

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto space-y-6 text-foreground">
      
      {/* Redirection / Navigation Top Bar */}
      <div className="nav-bar-anim flex items-center justify-between border-b border-border/40 pb-4 flex-wrap gap-3 select-none">
        <div className="flex items-center gap-2.5 text-xs text-muted font-light">
          <Link href="/search" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronLeft className="h-3.5 w-3.5" /> Search
          </Link>
          <span className="opacity-45">/</span>
          <span className="font-semibold text-foreground/80 truncate max-w-[200px]">
            #{problem.id} {problem.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`https://leetcode.com/problems/${problem.slug}/`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface/30 text-xs font-semibold text-muted hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <ExternalLink className="h-3.5 w-3.5" /> LeetCode
          </a>
          {isSignedIn && (
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-opacity cursor-pointer shadow-sm animate-pulse"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" /> AI Assistant
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* LEFT COLUMN: Problem Details (60% / 6 cols) */}
        <div className="lg:col-span-6 space-y-6 left-pane-anim">
          
          {/* Title & tags */}
          <div className="glass-card p-6 border border-border/50 text-left">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4 select-none">
              <h1 className="text-xl font-bold text-foreground/90">{problem.title}</h1>
              <span
                className={clsx(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border shrink-0",
                  problem.difficulty === "Easy"
                    ? "badge-easy"
                    : problem.difficulty === "Medium"
                    ? "badge-medium"
                    : "badge-hard"
                )}
              >
                {problem.difficulty}
              </span>
            </div>

            {/* Topic Tags */}
            {problem.topic_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4 select-none">
                <Tag className="h-3.5 w-3.5 text-muted shrink-0 mt-0.5" />
                {problem.topic_tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-surface border border-border/50 text-muted text-[10px] rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Metadata information */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted font-mono border-t border-border/30 pt-4 select-none">
              {problem.frequency && (
                <span className="flex items-center gap-1 border border-border bg-surface-elevated/40 px-2 py-0.5 rounded">
                  <Zap className="h-3 w-3 text-warning shrink-0" /> FREQ: {problem.frequency}
                </span>
              )}
              <span className="flex items-center gap-1 border border-border bg-surface-elevated/40 px-2 py-0.5 rounded font-sans">
                <Clock className="h-3 w-3 text-muted shrink-0" />
                {problem.difficulty === "Easy" ? "20m limit" : problem.difficulty === "Medium" ? "45m limit" : "90m limit"}
              </span>
              {problem.available_languages?.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Code2 className="h-3 w-3 text-muted shrink-0" />
                  {problem.available_languages.map((l: string) => (
                    <span key={l} className="px-1.5 py-0.5 bg-surface border border-border/40 rounded text-[9px]">
                      {LANG_LABELS[l] || l.toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description statement */}
          <div className="glass-card p-6 border border-border/50 text-left">
            <div className="flex items-center gap-2 mb-4 border-b border-border/30 pb-2 select-none">
              <BookOpen className="h-4.5 w-4.5 text-muted shrink-0" />
              <h2 className="text-[13px] uppercase tracking-widest font-semibold text-muted">
                Problem Statement
              </h2>
            </div>
            {problem.content ? (
              <div
                className="problem-content prose-sm max-w-none text-sm leading-relaxed text-foreground/90 font-light"
                dangerouslySetInnerHTML={{ __html: problem.content }}
              />
            ) : (
              <p className="text-muted text-xs font-light italic select-none">
                Description statement not available locally.{" "}
                <a
                  href={`https://leetcode.com/problems/${problem.slug}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground hover:underline"
                >
                  View description on LeetCode
                </a>
              </p>
            )}
          </div>

          {/* Example cases */}
          {testCases.length > 0 && (
            <div className="glass-card p-6 border border-border/50 text-left">
              <div className="flex items-center gap-2 mb-4 border-b border-border/30 pb-2 select-none">
                <CheckCircle className="h-4.5 w-4.5 text-success shrink-0" />
                <h2 className="text-[13px] uppercase tracking-widest font-semibold text-muted">
                  Example Cases
                </h2>
              </div>
              <div className="space-y-3">
                {testCases.map((tc, i) => (
                  <div
                    key={i}
                    className="bg-surface/30 rounded-xl p-3.5 border border-border/30 font-mono text-[11px] whitespace-pre-wrap text-foreground/85 relative"
                  >
                    <span className="text-muted text-[9px] font-sans absolute top-2.5 right-3 uppercase font-semibold select-none">
                      Example {i + 1}
                    </span>
                    {tc}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Hints & AI Callouts (40% / 4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Hints container */}
          {hints.length > 0 && (
            <div className="glass-card p-5 border border-border/50 right-pane-anim text-left">
              <div className="flex items-center gap-2 mb-4 border-b border-border/30 pb-2 select-none">
                <Lightbulb className="h-4.5 w-4.5 text-warning shrink-0" />
                <h2 className="text-[13px] uppercase tracking-widest font-semibold text-muted">
                  LeetCode Hints
                </h2>
                <span className="ml-auto text-[10px] text-muted font-mono font-semibold">
                  {hints.length} Total
                </span>
              </div>
              
              <div className="space-y-2.5">
                {hints.map((hint, i) => {
                  const isOpen = activeHintIdx === i;
                  return (
                    <div key={i} className="border border-border/40 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setActiveHintIdx(isOpen ? null : i)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-surface hover:bg-surface-elevated/40 transition-colors text-xs font-semibold text-muted cursor-pointer"
                      >
                        <span>Hint {i + 1}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-foreground">
                          {isOpen ? "Hide" : "Reveal"}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-4 py-3 bg-surface-elevated/20 border-t border-border/30 text-xs text-foreground/80 leading-relaxed font-light font-sans">
                          {hint}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI assistant prompt launcher monolith card */}
          <div
            className="glass-card p-5 border border-border/50 right-pane-anim text-left relative overflow-hidden flex flex-col justify-between min-h-[200px]"
            style={{
              background: "linear-gradient(135deg, rgba(var(--foreground-rgb), 0.01) 0%, rgba(var(--foreground-rgb), 0.03) 100%)",
            }}
          >
            <div className="absolute inset-0 grid-bg opacity-[0.01] pointer-events-none" />
            <div className="space-y-2 relative z-10 select-none">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                <Sparkles className="h-4.5 w-4.5 text-muted shrink-0" />
                <h3 className="text-[13px] uppercase tracking-widest font-semibold text-muted">
                  AI Workspace
                </h3>
              </div>
              <p className="text-[11px] text-muted font-light leading-relaxed pt-1">
                Generate tailored dry-run executions, code templates in your selected language, complexity optimizations, and direct logic analogies.
              </p>
            </div>

            {isSignedIn ? (
              <button
                onClick={() => setAiOpen(true)}
                className="mt-6 w-full py-3 rounded-xl text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer z-10 shadow-sm"
              >
                Open AI Assistant ✨
              </button>
            ) : (
              <Link
                href="/sign-in"
                className="mt-6 w-full py-3 rounded-xl text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 z-10 shadow-sm text-center"
              >
                Sign in to unlock AI →
              </Link>
            )}
          </div>

          {/* Redirection Links */}
          <div className="glass-card p-5 border border-border/50 right-pane-anim text-left select-none">
            <h3 className="text-[13px] uppercase tracking-widest font-semibold text-muted mb-4 border-b border-border/30 pb-2">
              External Sources
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { label: "View LeetCode Details", url: `https://leetcode.com/problems/${problem.slug}/` },
                { label: "LeetCode Discussions", url: `https://leetcode.com/problems/${problem.slug}/discuss/` },
                { label: "Community Solutions", url: `https://leetcode.com/problems/${problem.slug}/solutions/` },
              ].map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border bg-surface/30 hover:bg-surface-elevated/40 transition-colors text-xs font-semibold text-muted hover:text-foreground"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted" />
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>

      <AssistantDrawer
        problem={problem}
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
      />

      {/* Embedded scope stylesheet targeting custom HTML tags in LeetCode descriptions */}
      <style>{`
        .problem-content p { margin-bottom: 0.75rem; }
        .problem-content ul, .problem-content ol { padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .problem-content li { margin-bottom: 0.25rem; }
        .problem-content pre { background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.75rem; font-size: 0.75rem; overflow-x: auto; margin-bottom: 0.75rem; }
        .problem-content code { font-family: var(--font-mono); font-size: 0.85em; background: var(--surface-elevated); padding: 0.15em 0.35em; border-radius: 0.25rem; }
        .problem-content strong { color: var(--foreground); font-weight: 600; }
        .problem-content sup { font-size: 0.7em; }
        .problem-content img { max-width: 100%; border-radius: 0.75rem; margin: 0.5rem 0; }
      `}</style>
    </div>
  );
}
