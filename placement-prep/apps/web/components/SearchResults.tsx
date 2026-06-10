'use client';

import { useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import clsx from 'clsx';

const AssistantDrawer = dynamic(() => import('./AssistantDrawer'), { ssr: false });

const LANG_ICONS: Record<string, string> = {
  python: '🐍',
  java: '☕',
  cpp: '⚡',
  javascript: 'JS',
  typescript: 'TS',
  go: '🔵',
  rust: '🦀',
  kotlin: '🎯',
};

interface Result {
  id: number;
  title: string;
  slug: string;
  difficulty: string;
  topic_tags: string[];
  frequency?: number;
  combined_score?: number;
  available_languages?: string[];
}

interface SearchResultsProps {
  results: Result[];
  queryExpansions?: string[];
}

export function SearchResults({ results, queryExpansions = [] }: SearchResultsProps) {
  const [drawerProblem, setDrawerProblem] = useState<Result | null>(null);

  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-muted border border-dashed border-border rounded-2xl bg-surface/10 select-none">
        <p className="text-sm font-light">No problems found. Try adjusting your search query.</p>
      </div>
    );
  }

  return (
    <>
      {/* Query expansion chips */}
      {queryExpansions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 select-none text-left">
          <span className="text-xs text-muted font-light">Also searched:</span>
          {queryExpansions.map((q, i) => (
            <span
              key={i}
              className="text-xs px-2.5 py-1 rounded-full border border-border/50 bg-surface-elevated/30 text-muted font-medium"
            >
              {q}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-4 animate-fade-in">
        {results.map((q, idx) => (
          <div
            key={idx}
            className="glass-card p-5 hover-glow border border-border/50 hover:border-r-2 hover:border-r-foreground/45 transition-all duration-300 block text-left group"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="inline-flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/problems/${q.id}`}
                    className="font-semibold text-[15px] hover:text-foreground text-foreground/90 transition-colors"
                  >
                    {q.title}
                  </Link>
                  {/* External LeetCode link */}
                  <a
                    href={`https://leetcode.com/problems/${q.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted hover:text-foreground transition-colors inline-flex opacity-0 group-hover:opacity-100"
                    title="Open on LeetCode"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2 select-none">
                  <span
                    className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
                      q.difficulty === "Easy"
                        ? "badge-easy"
                        : q.difficulty === "Medium"
                        ? "badge-medium"
                        : "badge-hard"
                    )}
                  >
                    {q.difficulty}
                  </span>
                  {q.frequency ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] text-muted border border-border bg-surface-elevated font-mono">
                      Freq: {q.frequency}
                    </span>
                  ) : null}
                </div>

                {/* Language availability badges */}
                {q.available_languages && q.available_languages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 select-none">
                    <span className="text-[10px] text-muted font-light uppercase tracking-wider">Solutions:</span>
                    {q.available_languages.map((lang) => (
                      <span
                        key={lang}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted bg-surface-elevated/40 font-mono"
                        title={lang}
                      >
                        {LANG_ICONS[lang] || lang.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 flex-shrink-0 select-none">
                {/* Topic tags */}
                <div className="hidden md:flex flex-wrap gap-1.5 max-w-[200px] justify-end">
                  {q.topic_tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-surface border border-border/50 text-muted text-[10px] rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* AI button */}
                <button
                  onClick={() => setDrawerProblem(q)}
                  title="Open AI Assistant"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-foreground/35 bg-surface-elevated/40 text-foreground hover:bg-surface-elevated/80 transition-all duration-200 hover:scale-105 flex-shrink-0 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-muted" /> AI
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AssistantDrawer
        problem={drawerProblem}
        isOpen={!!drawerProblem}
        onClose={() => setDrawerProblem(null)}
      />
    </>
  );
}
