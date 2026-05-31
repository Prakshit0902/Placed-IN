'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ExternalLink, ChevronLeft, Loader2, Tag, Zap,
  BookOpen, Code2, Lightbulb, CheckCircle, Clock, Sparkles
} from 'lucide-react';
import { getProblemById } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';

const AssistantDrawer = dynamic(() => import('@/components/AssistantDrawer'), { ssr: false });

const LANG_LABELS: Record<string, string> = {
  python: 'Python', java: 'Java', cpp: 'C++', javascript: 'JS',
  typescript: 'TS', go: 'Go', rust: 'Rust', csharp: 'C#', kotlin: 'Kotlin',
};

const DIFF_COLOR: Record<string, string> = {
  Easy: 'badge-easy',
  Medium: 'badge-medium',
  Hard: 'badge-hard',
};

export default function ProblemViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { isSignedIn } = useAuth();
  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [activeHintIdx, setActiveHintIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProblemById(Number(id))
      .then((res) => {
        if (res.success) setProblem(res.data);
        else setError('Problem not found');
      })
      .catch(() => setError('Failed to load problem'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="text-center py-20">
        <p className="text-muted text-lg">{error || 'Problem not found'}</p>
        <Link href="/search" className="mt-4 inline-flex items-center gap-1.5 text-primary-light text-sm hover:underline">
          <ChevronLeft className="h-4 w-4" /> Back to Search
        </Link>
      </div>
    );
  }

  const hints: string[] = problem.hints || [];
  const testCases: string[] = (problem.example_testcases || '').trim().split('\n\n').filter(Boolean);

  return (
    <>
      <div className="max-w-5xl mx-auto animate-fade-in">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/search"
              className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" /> Search
            </Link>
            <span className="text-border/60">/</span>
            <span className="text-sm font-medium truncate max-w-[240px]">
              #{problem.id} {problem.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`https://leetcode.com/problems/${problem.slug}/`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 text-sm text-muted hover:text-foreground hover:border-border transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open on LeetCode
            </a>
            {isSignedIn && (
              <button
                onClick={() => setAiOpen(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))',
                  border: '1px solid rgba(139,92,246,0.35)',
                  color: '#a78bfa',
                }}
              >
                <Sparkles className="h-3.5 w-3.5" /> AI Assistant
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: title + content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Title card */}
            <div className="glass-card p-6">
              <div className="flex flex-wrap items-start gap-3 mb-4">
                <h1 className="text-2xl font-bold flex-1">{problem.title}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${DIFF_COLOR[problem.difficulty] || 'badge-easy'}`}>
                  {problem.difficulty}
                </span>
              </div>

              {/* Tags */}
              {problem.topic_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <Tag className="h-3.5 w-3.5 text-muted mt-0.5" />
                  {problem.topic_tags.map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-surface-elevated text-muted text-xs rounded-md border border-border/50">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                {problem.frequency && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-accent" /> Freq: {problem.frequency}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {problem.difficulty === 'Easy' ? '~20 min' : problem.difficulty === 'Medium' ? '~45 min' : '~90 min'}
                </span>
                {problem.available_languages?.length > 0 && (
                  <span className="flex items-center gap-1 flex-wrap">
                    <Code2 className="h-3 w-3" />
                    {problem.available_languages.map((l: string) => (
                      <span key={l} className="px-1.5 py-0.5 bg-surface font-mono border border-border/30 rounded text-[10px]">
                        {LANG_LABELS[l] || l}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>

            {/* Problem description */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-4 w-4 text-primary-light" />
                <h2 className="font-semibold">Problem Statement</h2>
              </div>
              {problem.content ? (
                <div
                  className="problem-content prose-sm max-w-none text-sm leading-relaxed text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: problem.content }}
                />
              ) : (
                <p className="text-muted text-sm italic">
                  Full description not available locally.{' '}
                  <a href={`https://leetcode.com/problems/${problem.slug}/`} target="_blank" rel="noreferrer"
                    className="text-primary-light hover:underline">
                    View on LeetCode
                  </a>
                </p>
              )}
            </div>

            {/* Test cases */}
            {testCases.length > 0 && (
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <h2 className="font-semibold">Example Test Cases</h2>
                </div>
                <div className="space-y-3">
                  {testCases.map((tc, i) => (
                    <div key={i}
                      className="bg-surface rounded-lg p-3 border border-border/50 font-mono text-xs whitespace-pre-wrap text-foreground/80">
                      <span className="text-muted text-[10px] font-sans block mb-1">Example {i + 1}</span>
                      {tc}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: hints + quick actions */}
          <div className="space-y-5">
            {/* Hints */}
            {hints.length > 0 && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="h-4 w-4 text-accent" />
                  <h2 className="font-semibold text-sm">LeetCode Hints</h2>
                  <span className="ml-auto text-xs text-muted">{hints.length} hint{hints.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {hints.map((hint, i) => (
                    <div key={i}>
                      <button
                        onClick={() => setActiveHintIdx(activeHintIdx === i ? null : i)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface hover:bg-surface-elevated transition-colors text-sm text-left"
                      >
                        <span className="text-muted">Hint {i + 1}</span>
                        <span className="text-xs text-primary-light">
                          {activeHintIdx === i ? 'Hide' : 'Reveal'}
                        </span>
                      </button>
                      {activeHintIdx === i && (
                        <div className="mt-1 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20 text-xs text-foreground/80 leading-relaxed">
                          {hint}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Assistant CTA */}
            <div className="glass-card p-5 border border-primary/20"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))' }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary-light" />
                <h2 className="font-semibold text-sm">AI Assistant</h2>
              </div>
              <p className="text-muted text-xs mb-4 leading-relaxed">
                Get step-by-step explanations, creative analogies, dry-run traces, solution code in any language, and complexity analysis.
              </p>
              {isSignedIn ? (
                <button
                  onClick={() => setAiOpen(true)}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  Open AI Assistant ✨
                </button>
              ) : (
                <Link href="/sign-in"
                  className="block w-full py-2.5 rounded-lg text-sm font-medium text-center text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  Sign in to unlock AI →
                </Link>
              )}
            </div>

            {/* Similar link */}
            <div className="glass-card p-5">
              <h2 className="font-semibold text-sm mb-3">Links</h2>
              <div className="space-y-2">
                <a
                  href={`https://leetcode.com/problems/${problem.slug}/`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface hover:bg-surface-elevated transition-colors text-sm"
                >
                  <span>View on LeetCode</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted" />
                </a>
                <a
                  href={`https://leetcode.com/problems/${problem.slug}/discuss/`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface hover:bg-surface-elevated transition-colors text-sm"
                >
                  <span>Discussions</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted" />
                </a>
                <a
                  href={`https://leetcode.com/problems/${problem.slug}/solutions/`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface hover:bg-surface-elevated transition-colors text-sm"
                >
                  <span>Community Solutions</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AssistantDrawer
        problem={problem}
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
      />

      {/* Scoped CSS for HTML problem content from LeetCode */}
      <style>{`
        .problem-content p { margin-bottom: 0.75rem; }
        .problem-content ul, .problem-content ol { padding-left: 1.25rem; margin-bottom: 0.75rem; }
        .problem-content li { margin-bottom: 0.25rem; }
        .problem-content pre { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.5rem; padding: 0.75rem; font-size: 0.75rem; overflow-x: auto; margin-bottom: 0.75rem; }
        .problem-content code { font-family: 'Fira Code', monospace; font-size: 0.8em; background: rgba(255,255,255,0.06); padding: 0.1em 0.35em; border-radius: 0.25rem; }
        .problem-content strong { color: var(--foreground); }
        .problem-content sup { font-size: 0.7em; }
        .problem-content img { max-width: 100%; border-radius: 0.5rem; margin: 0.5rem 0; }
      `}</style>
    </>
  );
}
