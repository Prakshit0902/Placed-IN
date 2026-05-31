'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

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
      <div className="text-center py-16 text-muted">
        <p>No problems found. Try adjusting your query.</p>
      </div>
    );
  }

  return (
    <>
      {/* Query expansion chips */}
      {queryExpansions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-muted">Also searched:</span>
          {queryExpansions.map((q, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded-full border border-border/50 text-muted"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              {q}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3 animate-fade-in">
        {results.map((q, idx) => (
          <div key={idx} className="glass-card p-5 hover-glow transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Title — links to internal viewer */}
                <Link
                  href={`/problems/${q.id}`}
                  className="font-semibold text-base hover:text-primary-light transition-colors inline-flex items-center gap-1.5"
                >
                  {q.title}
                </Link>
                {/* External LeetCode link */}
                <a
                  href={`https://leetcode.com/problems/${q.slug}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-muted hover:text-foreground transition-colors inline-flex"
                  title="Open on LeetCode"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    q.difficulty === 'Easy' ? 'badge-easy' :
                    q.difficulty === 'Medium' ? 'badge-medium' : 'badge-hard'
                  }`}>
                    {q.difficulty}
                  </span>
                  {q.frequency ? (
                    <span className="px-2 py-0.5 rounded-full text-xs text-accent border border-accent/30 bg-accent/10">
                      Freq: {q.frequency}
                    </span>
                  ) : null}
                </div>

                {/* Language availability badges */}
                {q.available_languages && q.available_languages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-muted">Solutions:</span>
                    {q.available_languages.map(lang => (
                      <span key={lang}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-slate-400 font-mono"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                        title={lang}>
                        {LANG_ICONS[lang] || lang.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 flex-shrink-0">
                {/* Topic tags */}
                <div className="hidden md:flex flex-wrap gap-1.5 max-w-[180px] justify-end">
                  {q.topic_tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-surface-elevated text-muted text-[10px] rounded-md border border-border/50">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* AI button */}
                <button
                  onClick={() => setDrawerProblem(q)}
                  title="Open AI Assistant"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-105 flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                    border: '1px solid rgba(139,92,246,0.3)',
                    color: '#a78bfa',
                  }}
                >
                  <span>✨</span> AI
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
