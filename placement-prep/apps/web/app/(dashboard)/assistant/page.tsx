'use client';

import { useState, useCallback, useEffect, useRef, FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  searchProblems,
  getProblemExplanation,
  getProblemCode,
  getProblemHints,
  getProblemComplexity,
  getSimilarProblems,
  isQuotaError,
  type QuotaError,
} from '@/lib/api';

import {
  Search,
  Sparkles,
  Brain,
  ArrowRight,
  ExternalLink,
  Code2,
  List,
  Cpu,
  Layers,
  Lightbulb,
  Play,
  Check,
  Copy,
  Terminal,
} from 'lucide-react';
import clsx from 'clsx';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-csharp';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Problem {
  id: number | string;
  title: string;
  slug: string;
  difficulty: string;
  topic_tags: string[];
  frequency?: number;
  combined_score?: number;
  available_languages?: string[];
  platform?: 'leetcode' | 'codeforces';
}

interface DryRunStep {
  iteration: string;
  state: string;
  action: string;
}

interface ExplanationData {
  analogy: string;
  approach_steps: string[];
  dry_run: DryRunStep[];
  code: string;
  time_complexity: string;
  space_complexity: string;
  code_source: 'database' | 'llm_generated' | 'llm_translated' | 'scraped_cf';
}

interface HintData {
  hint: string;
  level: number;
  is_final_hint: boolean;
}

interface ComplexityData {
  time_complexity: string;
  space_complexity: string;
  line_by_line: string[];
  is_optimal: boolean;
  alternatives: { name: string; time_complexity: string; space_complexity: string; tradeoff: string }[];
}

interface SimilarData {
  problems: string[];
  reasoning: string;
}

type Tab = 'explain' | 'dryrun' | 'code' | 'hints' | 'complexity';

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Medium array questions asked at Amazon",
  "Hard graph problems with DP",
  "String manipulation for Google",
  "Easy questions for beginners",
];

const ALL_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'csharp', label: 'C#' },
];

const CF_LANGUAGES = [
  { value: 'cpp', label: 'C++' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  Medium: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
  Hard: 'text-red-400 border-red-500/20 bg-red-500/5',
};

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

// ── Helper Subcomponents ──────────────────────────────────────────────────────

function QuotaBanner({ error, onUpgrade }: { error: QuotaError; onUpgrade: () => void }) {
  const resetsAt = error.resets_at
    ? new Date(error.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'tomorrow';

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(10,10,20,0.85)' }}>
      <div className="text-center px-8 max-w-sm">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-xl font-bold text-white mb-2">
          {error.premium_required ? 'Premium Feature' : 'Daily Limit Reached'}
        </h3>
        <p className="text-slate-300 text-sm mb-1">{error.message}</p>
        {!error.premium_required && (
          <p className="text-slate-400 text-xs mb-6">Resets at {resetsAt}</p>
        )}
        <button
          onClick={onUpgrade}
          className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
        >
          Upgrade to Premium →
        </button>
        <p className="text-slate-500 text-xs mt-3">
          Unlimited AI explanations, translations & analysis
        </p>
      </div>
    </div>
  );
}

function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      {label && <p className="text-slate-400 text-sm">{label}</p>}
    </div>
  );
}

function highlightCode(code: string, language: string): string {
  const cleanCode = code.replace(/\\n/g, '\n');

  if (typeof window === 'undefined') {
    return cleanCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  try {
    const langMap: Record<string, string> = {
      cpp: 'cpp',
      c: 'c',
      python: 'python',
      java: 'java',
      javascript: 'javascript',
      typescript: 'typescript',
      go: 'go',
      rust: 'rust',
      kotlin: 'kotlin',
      csharp: 'csharp',
    };

    const targetLang = langMap[language] || 'javascript';
    const grammar = Prism.languages[targetLang] || Prism.languages.javascript;
    return Prism.highlight(cleanCode, grammar, targetLang);
  } catch (e) {
    console.error('Prism highlighting error:', e);
    return cleanCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code.replace(/\\n/g, '\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightedHtml = highlightCode(code, language);

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10"
        style={{ background: 'rgba(255,255,255,0.04)' }}>
        <span className="text-xs text-slate-400 font-mono">{language}</span>
        <button onClick={copy}
          className="text-xs px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          style={{ background: copied ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)', color: copied ? '#34d399' : '#94a3b8' }}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed"
        style={{ background: '#0b0b14', maxHeight: '480px', color: '#f8f8f2' }}>
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function AssistantPage() {
  const { getToken } = useAuth();

  // Search RAG States
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Problem[] | null>(null);
  const [queryExpansions, setQueryExpansions] = useState<string[]>([]);

  // Selected Problem Workspace States
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('explain');
  const [language, setLanguage] = useState('python');

  // Selected Problem Feature States
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainQuota, setExplainQuota] = useState<QuotaError | null>(null);

  const [codeData, setCodeData] = useState<{ code: string; code_source: 'database' | 'llm_generated' | 'llm_translated' | 'scraped_cf' } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeQuota, setCodeQuota] = useState<QuotaError | null>(null);

  const [hints, setHints] = useState<Partial<Record<1 | 2 | 3, HintData>>>({});
  const [hintLoading, setHintLoading] = useState<Partial<Record<1 | 2 | 3, boolean>>>({});
  const [hintQuota, setHintQuota] = useState<QuotaError | null>(null);

  const [complexity, setComplexity] = useState<ComplexityData | null>(null);
  const [complexityLoading, setComplexityLoading] = useState(false);
  const [complexityQuota, setComplexityQuota] = useState<QuotaError | null>(null);

  const [similar, setSimilar] = useState<SimilarData | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);

  // GSAP animation targets
  const pageContainerRef = useRef<HTMLDivElement>(null);

  const availableLanguages = selectedProblem?.platform === 'codeforces' ? CF_LANGUAGES : ALL_LANGUAGES;

  // Handle problem selection changes
  const handleSelectProblem = (problem: Problem) => {
    setSelectedProblem(problem);
    setActiveTab('explain');
    const defaultLang = problem.platform === 'codeforces' ? 'cpp' : 'python';
    setLanguage(defaultLang);

    // Reset workspace state
    setExplanation(null);
    setExplainError(null);
    setExplainQuota(null);
    setCodeData(null);
    setCodeQuota(null);
    setHints({});
    setHintQuota(null);
    setComplexity(null);
    setComplexityQuota(null);
    setSimilar(null);

    // Trigger explanation fetch automatically
    fetchExplanation(problem, defaultLang);
  };

  // Run GSAP initial load animations
  useGSAP(() => {
    gsap.fromTo(
      ".assistant-header",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
    );
    gsap.fromTo(
      ".assistant-search-box",
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.1 }
    );
    gsap.fromTo(
      ".suggestion-card",
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: "power2.out", delay: 0.15 }
    );
  }, { scope: pageContainerRef });

  // Execute RAG Search
  const executeSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await searchProblems(searchQuery);
      if (res.success && res.data) {
        setSearchResults(res.data);
        setQueryExpansions(res.query_expansions || []);
        
        // Trigger list reveal animation
        setTimeout(() => {
          gsap.fromTo(
            ".result-item",
            { opacity: 0, x: -10 },
            { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" }
          );
        }, 50);
      } else {
        setSearchResults([]);
        setQueryExpansions([]);
      }
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (suggestQuery: string) => {
    setQuery(suggestQuery);
    executeSearch(suggestQuery);
  };

  // Fetch functions for right-pane workspace
  const fetchFromExtension = async (prob: Problem, targetLang: string) => {
    if (prob.platform !== 'codeforces') return undefined;
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
    if (!extensionId) return undefined;
    
    try {
      const response = await (window as any).chrome?.runtime?.sendMessage(extensionId, {
        action: 'GET_CF_SUBMISSION_CODE',
        problemId: prob.id,
        language: targetLang
      });
      return response?.success ? { code: response.code, lang: response.scrapedLanguage } : undefined;
    } catch (error) {
      console.error('Failed to fetch from CF extension', error);
      return undefined;
    }
  };

  const fetchExplanation = useCallback(async (prob: Problem | null, lang: string) => {
    const activeProblem = prob || selectedProblem;
    if (!activeProblem) return;

    setExplainLoading(true);
    setExplainError(null);
    setExplainQuota(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const extensionData = await fetchFromExtension(activeProblem, lang);
      const result = await getProblemExplanation(
        activeProblem.id, 
        lang, 
        token, 
        activeProblem.platform || 'leetcode', 
        extensionData?.code,
        extensionData?.lang
      );

      if (isQuotaError(result)) {
        setExplainQuota(result);
      } else {
        setExplanation(result);
        if (!codeData) {
          setCodeData({ code: result.code, code_source: result.code_source });
        }
      }
    } catch (e: any) {
      setExplainError(e.message || 'Failed to generate explanation');
    } finally {
      setExplainLoading(false);
    }
  }, [selectedProblem, getToken, codeData]);

  const fetchCode = useCallback(async (lang: string) => {
    if (!selectedProblem) return;
    setCodeLoading(true);
    setCodeQuota(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const extensionData = await fetchFromExtension(selectedProblem, lang);
      const result = await getProblemCode(
        selectedProblem.id, 
        lang, 
        token, 
        selectedProblem.platform || 'leetcode',
        extensionData?.code,
        extensionData?.lang
      );
      if (isQuotaError(result)) {
        setCodeQuota(result);
      } else {
        setCodeData(result);
      }
    } catch (e: any) {
      console.error('Code fetch error:', e);
    } finally {
      setCodeLoading(false);
    }
  }, [selectedProblem, getToken]);

  const fetchHint = useCallback(async (level: 1 | 2 | 3) => {
    if (!selectedProblem) return;
    setHintLoading(prev => ({ ...prev, [level]: true }));
    setHintQuota(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await getProblemHints(selectedProblem.id, level, token, selectedProblem.platform || 'leetcode');
      if (isQuotaError(result)) {
        setHintQuota(result);
      } else {
        setHints(prev => ({ ...prev, [level]: result }));
      }
    } catch (e: any) {
      console.error('Hint error:', e);
    } finally {
      setHintLoading(prev => ({ ...prev, [level]: false }));
    }
  }, [selectedProblem, getToken]);

  const fetchComplexity = useCallback(async (lang: string) => {
    if (!selectedProblem) return;
    setComplexityLoading(true);
    setComplexityQuota(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await getProblemComplexity(selectedProblem.id, lang, token, selectedProblem.platform || 'leetcode');
      if (isQuotaError(result)) {
        setComplexityQuota(result);
      } else {
        setComplexity(result);
      }
    } catch (e: any) {
      console.error('Complexity error:', e);
    } finally {
      setComplexityLoading(false);
    }
  }, [selectedProblem, getToken]);

  const loadSimilarProblems = useCallback(async () => {
    if (!selectedProblem) return;
    setSimilarLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await getSimilarProblems(selectedProblem.id, token, selectedProblem.platform || 'leetcode');
      if (!isQuotaError(result)) {
        setSimilar(result);
      }
    } catch (e: any) {
      console.error('Similar problems error:', e);
    } finally {
      setSimilarLoading(false);
    }
  }, [selectedProblem, getToken]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setExplanation(null);
    setCodeData(null);
    setComplexity(null);
    setExplainQuota(null);
    setCodeQuota(null);
    setComplexityQuota(null);
    
    // Automatically trigger explanation refetch for new language
    if (selectedProblem) {
      fetchExplanation(selectedProblem, lang);
    }
  };

  const goToBilling = () => {
    window.location.href = '/settings/billing';
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'explain', label: 'Explain', icon: Sparkles },
    { id: 'dryrun', label: 'Dry Run', icon: Play },
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'hints', label: 'Hints', icon: Lightbulb },
    { id: 'complexity', label: 'Complexity', icon: Cpu },
  ];

  const codeSource = codeData?.code_source || explanation?.code_source;
  const codeSourceLabel = codeSource === 'database' ? '✅ Verified DB' : 
                          codeSource === 'scraped_cf' ? '🌐 Scraped' : 
                          codeSource === 'llm_translated' ? '🔀 Translated' : '✨ AI Generated';

  return (
    <div ref={pageContainerRef} className="max-w-7xl mx-auto space-y-6 text-foreground h-[calc(100vh-6rem)] flex flex-col">
      {/* Background glow effects */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -left-32 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="assistant-header flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/40 shrink-0 gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-400" />
            AI Study Workspace
          </h1>
          <p className="text-sm text-muted font-light mt-1">
            Search for topics or questions in natural language, select a match, and let the AI break it down.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface/40 text-[10px] uppercase tracking-widest text-muted font-mono select-none">
          <Brain className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          RAG enabled
        </div>
      </div>

      {/* Split pane body */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: Semantic RAG Search Pane (35% width on desktop) */}
        <div className="w-full lg:w-[35%] flex flex-col min-h-0 shrink-0">
          
          {/* Search box input container */}
          <div className="assistant-search-box mb-4">
            <form onSubmit={handleSearchSubmit} className="relative group w-full select-none">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className={`h-5 w-5 transition-colors ${query ? "text-foreground" : "text-muted group-focus-within:text-foreground"}`} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search e.g. 'Amazon dynamic programming questions'"
                className="w-full bg-surface/30 border border-border/50 rounded-2xl pl-12 pr-24 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-all text-foreground placeholder:text-muted/50"
              />
              <div className="absolute inset-y-1.5 right-1.5 flex items-center">
                <button
                  type="submit"
                  disabled={searchLoading || !query.trim()}
                  className="bg-foreground text-background hover:opacity-90 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {searchLoading ? "Searching..." : "Search"}
                </button>
              </div>
            </form>
          </div>

          {/* Results/Suggestions panel (scrollable) */}
          <div className="flex-1 overflow-y-auto pr-1">
            {searchLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted space-y-4 select-none">
                <Brain className="h-10 w-10 animate-pulse text-violet-400" />
                <p className="animate-pulse text-[10px] uppercase tracking-widest font-mono text-muted text-center max-w-[200px]">
                  RAG is expanding vectors and matching problems...
                </p>
              </div>
            ) : searchResults !== null ? (
              
              // Search Results Area
              <div className="space-y-3">
                {/* Query expansion chips */}
                {queryExpansions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-4 select-none text-left">
                    <span className="text-[10px] text-muted font-light">Expansions:</span>
                    {queryExpansions.slice(0, 3).map((q, i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 rounded-full border border-border/40 bg-surface-elevated/20 text-muted font-medium">
                        {q}
                      </span>
                    ))}
                  </div>
                )}

                {searchResults.length === 0 ? (
                  <div className="text-center py-16 text-muted border border-dashed border-border/80 rounded-2xl bg-surface/10 select-none">
                    <p className="text-xs font-light">No problems found. Adjust query words.</p>
                  </div>
                ) : (
                  searchResults.map((prob) => {
                    const isSelected = selectedProblem?.id === prob.id;
                    return (
                      <div
                        key={prob.id}
                        onClick={() => handleSelectProblem(prob)}
                        className={clsx(
                          "glass-card p-4 border transition-all duration-300 block text-left cursor-pointer relative group result-item",
                          isSelected
                            ? "border-violet-500 bg-surface-elevated/70 shadow-[0_0_15px_rgba(139,92,246,0.15)] scale-[1.01]"
                            : "border-border/50 hover:border-violet-500/50 hover:bg-surface-elevated/20 hover:scale-[1.01]"
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-muted font-mono block">#{prob.id}</span>
                            <span className="font-semibold text-sm hover:text-foreground text-foreground/90 transition-colors block truncate mt-0.5">
                              {prob.title}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className={clsx(
                                "px-2 py-0.2 rounded-full text-[9px] font-semibold uppercase tracking-wider border",
                                prob.difficulty === "Easy" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" :
                                prob.difficulty === "Medium" ? "text-amber-400 border-amber-500/20 bg-amber-500/5" :
                                "text-red-400 border-red-500/20 bg-red-500/5"
                              )}>
                                {prob.difficulty}
                              </span>
                              {prob.frequency ? (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] text-muted border border-border/50 bg-surface-elevated/20 font-mono">
                                  {Math.round(prob.frequency)}% Freq
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-1.5">
                            {/* Lang icons */}
                            {prob.available_languages && prob.available_languages.length > 0 && (
                              <div className="flex gap-0.5" title="Available solutions">
                                {prob.available_languages.slice(0, 3).map((l) => (
                                  <span key={l} className="text-[11px] leading-none opacity-80">{LANG_ICONS[l] || '💻'}</span>
                                ))}
                                {prob.available_languages.length > 3 && (
                                  <span className="text-[8px] text-muted font-mono leading-none">+{prob.available_languages.length - 3}</span>
                                )}
                              </div>
                            )}
                            <button className="text-muted group-hover:text-violet-400 transition-colors">
                              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              
              // Suggestions Area (Welcome State)
              <div className="space-y-4">
                <div className="text-left border-b border-border/30 pb-2 select-none">
                  <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">
                    Suggested RAG Prompts
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {SUGGESTIONS.map((suggest, i) => (
                    <div
                      key={i}
                      onClick={() => handleSuggestionClick(suggest)}
                      className="glass-card p-4 cursor-pointer hover:bg-surface-elevated/40 border border-border/50 hover:scale-[1.02] transition-all duration-300 flex items-center justify-between group text-left select-none suggestion-card"
                    >
                      <p className="text-xs font-semibold text-foreground/80 truncate pr-2">
                        &ldquo;{suggest}&rdquo;
                      </p>
                      <ArrowRight className="h-3.5 w-3.5 text-muted opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Workspace (65% width on desktop) */}
        <div className="flex-1 glass-card border border-border/40 rounded-2xl flex flex-col min-h-0 overflow-hidden relative">
          
          {selectedProblem === null ? (
            
            // Welcome workspace state
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 relative group">
                <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-md group-hover:blur-xl transition-all" />
                <Brain className="h-8 w-8 text-violet-400 relative z-10 animate-pulse" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-base font-bold text-white">AI Workspace Ready</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-light">
                  Search topics, languages, companies or constraints on the left. Click on any question to load its details, analysis, and solution logic right here.
                </p>
              </div>
            </div>
          ) : (
            
            // Problem loaded workspace state
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Workspace Header */}
              <div className="flex items-start justify-between px-6 py-5 border-b border-border/40 bg-surface/10 shrink-0">
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-violet-400 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 select-none">
                      <Sparkles className="h-3 w-3" />
                      Workspace Analysis
                    </span>
                    <span className="text-white/20 select-none">·</span>
                    <span className="text-slate-400 text-xs font-mono">#{selectedProblem.id}</span>
                    <span className="text-white/20 select-none">·</span>
                    <span className="text-[10px] font-semibold text-muted bg-surface border border-border px-1.5 py-0.2 rounded-md uppercase font-mono tracking-wider">{selectedProblem.platform || 'leetcode'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-white font-bold text-base leading-tight truncate">{selectedProblem.title}</h2>
                    <a
                      href={`https://leetcode.com/problems/${selectedProblem.slug}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-foreground transition-colors shrink-0"
                      title="Open LeetCode link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 select-none">
                    <span className={clsx(
                      "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border leading-none",
                      DIFFICULTY_COLORS[selectedProblem.difficulty] || 'text-slate-400 border-white/10'
                    )}>
                      {selectedProblem.difficulty}
                    </span>
                    {(selectedProblem.topic_tags || []).slice(0, 3).map(tag => (
                      <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full border border-white/5 text-slate-400 leading-none">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {/* Language Selector */}
                  <select
                    value={language}
                    onChange={e => handleLanguageChange(e.target.value)}
                    className="text-xs rounded-xl border border-white/10 px-3 py-2 text-slate-300 focus:outline-none focus:border-violet-500 cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    {availableLanguages.map(l => (
                      <option key={l.value} value={l.value} style={{ background: '#10101d' }}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="flex gap-1 px-4 pt-2.5 pb-0 border-b border-border/40 bg-surface/5 shrink-0 select-none">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl transition-all relative cursor-pointer border-b-2",
                        isActive
                          ? "text-violet-400 bg-violet-500/10 border-violet-500"
                          : "text-muted border-transparent hover:text-foreground hover:bg-surface-elevated/20"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Workspace Body Content (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 relative text-left">
                
                {/* ── EXPLAIN TAB ── */}
                {activeTab === 'explain' && (
                  <div className="space-y-6 animate-fade-in relative min-h-[150px]">
                    {explainQuota && <QuotaBanner error={explainQuota} onUpgrade={goToBilling} />}
                    {explainLoading && <LoadingSpinner label="Generating core explanation breakdown..." />}
                    {explainError && (
                      <div className="text-red-400 text-xs text-center py-10 bg-red-500/5 rounded-2xl border border-red-500/10">{explainError}</div>
                    )}
                    
                    {explanation && !explainLoading && (
                      <div className="space-y-6">
                        {/* Analogy Box */}
                        <div className="rounded-2xl p-5 border border-violet-500/20 relative overflow-hidden"
                          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.06) 100%)' }}>
                          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-xl pointer-events-none" />
                          <h3 className="text-violet-300 font-bold text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5 select-none">
                            <span>🎯</span> Real-World Analogy
                          </h3>
                          <p className="text-slate-200 text-sm leading-relaxed font-light">{explanation.analogy}</p>
                        </div>

                        {/* Approach Steps Stepper */}
                        <div className="rounded-2xl p-5 border border-white/[0.07] bg-white/[0.02]">
                          <h3 className="text-blue-300 font-bold text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5 select-none">
                            <span>📋</span> Core Algorithmic Steps
                          </h3>
                          <ol className="space-y-3.5">
                            {explanation.approach_steps.map((step, i) => (
                              <li key={i} className="flex gap-3 text-sm">
                                <span className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                                  style={{ background: 'rgba(99,102,241,0.25)', color: '#c7d2fe' }}>
                                  {i + 1}
                                </span>
                                <span className="text-slate-300 leading-relaxed pt-0.5 font-light">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Complexity Quick Badges */}
                        <div className="flex gap-4">
                          <div className="flex-1 rounded-2xl p-4 border border-white/[0.07] text-center bg-white/[0.01]">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 select-none">Time Complexity</div>
                            <div className="text-emerald-400 font-bold font-mono text-sm">{explanation.time_complexity}</div>
                          </div>
                          <div className="flex-1 rounded-2xl p-4 border border-white/[0.07] text-center bg-white/[0.01]">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 select-none">Space Complexity</div>
                            <div className="text-blue-400 font-bold font-mono text-sm">{explanation.space_complexity}</div>
                          </div>
                        </div>

                        {/* Similar follow-up studies */}
                        <div className="pt-4 border-t border-white/[0.07]">
                          {!similar && !similarLoading && (
                            <button
                              onClick={loadSimilarProblems}
                              className="w-full py-2.5 rounded-xl border border-white/[0.07] text-xs font-semibold text-slate-300 hover:bg-white/[0.03] transition-colors flex items-center justify-center gap-2 cursor-pointer select-none"
                            >
                              <span>🔍</span> Load Similar Progression Problems
                            </button>
                          )}
                          
                          {similarLoading && <LoadingSpinner label="Evaluating syllabus recommendations..." />}

                          {similar && similar.problems.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex flex-col gap-1 text-left">
                                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1 select-none">
                                  <Terminal className="h-3.5 w-3.5 text-violet-400" /> Study Progression path
                                </span>
                                <span className="text-[11px] text-slate-500 font-light">{similar.reasoning}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {similar.problems.map((slug) => (
                                  <a
                                    key={slug}
                                    href={`https://leetcode.com/problems/${slug}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] px-3.5 py-1.5 rounded-full border border-white/10 text-slate-300 hover:border-violet-500/40 hover:text-violet-300 hover:bg-violet-500/5 transition-all duration-150"
                                    style={{ background: 'rgba(255,255,255,0.03)' }}
                                  >
                                    {slug}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── DRY RUN TAB ── */}
                {activeTab === 'dryrun' && (
                  <div className="space-y-4 animate-fade-in">
                    {!explanation && !explainLoading && (
                      <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-border/80 rounded-2xl bg-surface/5">
                        Please visit the Explain tab first to generate variables mapping.
                      </div>
                    )}
                    {explainLoading && <LoadingSpinner label="Awaiting variable calculations..." />}
                    
                    {explanation && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border/30 pb-2 select-none">
                          <Play className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs text-slate-400 font-light">
                            Dry Run trace watchers on first input test case:
                          </span>
                        </div>
                        <div className="space-y-3">
                          {explanation.dry_run.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-6 select-none">Dry run trace unavailable for this problem representation.</p>
                          ) : (
                            explanation.dry_run.map((step, i) => (
                              <div key={i} className="rounded-xl p-4 border border-white/[0.07] bg-white/[0.015] flex gap-4 hover:bg-white/[0.03] transition-colors" >
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                                    style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd' }}>
                                    {step.iteration}
                                  </div>
                                </div>
                                <div className="flex-grow min-w-0">
                                  <div className="text-slate-200 text-xs font-semibold mb-1">{step.action}</div>
                                  <code className="text-[11px] text-emerald-400 font-mono block truncate bg-[#07070d] py-1.5 px-3 rounded-lg border border-white/5">{step.state}</code>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── CODE TAB ── */}
                {activeTab === 'code' && (
                  <div className="space-y-4 animate-fade-in relative min-h-[150px]">
                    {codeQuota && <QuotaBanner error={codeQuota} onUpgrade={goToBilling} />}
                    
                    {!codeData && !codeLoading && !codeQuota && (
                      <div className="text-center py-16 space-y-4 border border-dashed border-border/80 rounded-2xl bg-surface/5">
                        <div className="text-4xl">⌨️</div>
                        <p className="text-xs text-slate-400">Generate optimal code for {availableLanguages.find(l => l.value === language)?.label}</p>
                        <button
                          onClick={() => fetchCode(language)}
                          className="px-5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 hover:scale-105 cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
                        >
                          Unlock Solution Code
                        </button>
                      </div>
                    )}

                    {codeLoading && <LoadingSpinner label={`Drafting clean ${availableLanguages.find(l => l.value === language)?.label} representation...`} />}
                    
                    {codeData && !codeLoading && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between select-none">
                          <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10 text-slate-400 bg-white/[0.02]">
                            {codeSourceLabel}
                          </span>
                          <button
                            onClick={() => { setCodeData(null); fetchCode(language); }}
                            className="text-[11px] text-slate-500 hover:text-violet-400 transition-colors cursor-pointer"
                          >
                            Regenerate Code ↺
                          </button>
                        </div>
                        <CodeBlock code={codeData.code} language={language} />
                      </div>
                    )}
                  </div>
                )}

                {/* ── HINTS TAB ── */}
                {activeTab === 'hints' && (
                  <div className="space-y-4 animate-fade-in relative min-h-[150px]">
                    {hintQuota && <QuotaBanner error={hintQuota} onUpgrade={goToBilling} />}
                    
                    <div className="space-y-4">
                      {([1, 2, 3] as const).map(level => (
                        <div key={level} className="rounded-xl border border-white/[0.07] overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.025)' }}>
                          <div className="flex items-center justify-between px-4 py-3 select-none">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                                style={{
                                  background: level === 1 ? 'rgba(52,211,153,0.2)' : level === 2 ? 'rgba(251,191,36,0.2)' : 'rgba(139,92,246,0.2)',
                                  color: level === 1 ? '#34d399' : level === 2 ? '#fbbf24' : '#c4b5fd',
                                }}>
                                Level {level}
                              </span>
                              <span className="text-[10px] text-slate-500 font-light">
                                {level === 1 ? 'Vague direction nudge' : level === 2 ? 'Key strategic insight' : 'Pseudocode breakdown'}
                              </span>
                            </div>
                            {level === 3 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold uppercase tracking-wider">Premium</span>
                            )}
                          </div>
                          
                          {hints[level] ? (
                            <div className="px-4 pb-4">
                              <p className="text-slate-200 text-xs leading-relaxed border-t border-white/[0.05] pt-3 font-light">
                                {hints[level]!.hint}
                              </p>
                            </div>
                          ) : (
                            <div className="px-4 pb-4">
                              <button
                                onClick={() => fetchHint(level)}
                                disabled={hintLoading[level]}
                                className="w-full py-2 rounded-lg text-xs font-semibold hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50 select-none"
                                style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8' }}
                              >
                                {hintLoading[level] ? 'Consulting mentor...' : `Unlock Hint ${level} 🔓`}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── COMPLEXITY TAB ── */}
                {activeTab === 'complexity' && (
                  <div className="space-y-5 animate-fade-in relative min-h-[150px]">
                    {complexityQuota && <QuotaBanner error={complexityQuota} onUpgrade={goToBilling} />}
                    
                    {!complexity && !complexityLoading && !complexityQuota && (
                      <div className="text-center py-16 space-y-4 border border-dashed border-border/80 rounded-2xl bg-surface/5">
                        <div className="text-4xl">📊</div>
                        <p className="text-xs text-slate-400">Perform deep Big-O complexity audits on your solution</p>
                        <button
                          onClick={() => fetchComplexity(language)}
                          className="px-5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 hover:scale-105 cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
                        >
                          Audit Complexity
                        </button>
                      </div>
                    )}

                    {complexityLoading && <LoadingSpinner label="Auditing complexity contributions..." />}
                    
                    {complexity && !complexityLoading && (
                      <div className="space-y-5">
                        
                        {/* Overall Big-O Summary */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-xl p-4 border border-white/[0.07] text-center bg-white/[0.015]">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 select-none">Time Complexity</div>
                            <div className="text-emerald-400 font-bold font-mono text-base">{complexity.time_complexity}</div>
                          </div>
                          <div className="rounded-xl p-4 border border-white/[0.07] text-center bg-white/[0.015]">
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 select-none">Space Complexity</div>
                            <div className="text-blue-400 font-bold font-mono text-base">{complexity.space_complexity}</div>
                          </div>
                        </div>

                        {/* Is Optimal Status Badge */}
                        <div className={clsx(
                          "text-center text-xs py-2 px-4 rounded-xl border select-none font-semibold",
                          complexity.is_optimal 
                            ? 'border-emerald-500/25 text-emerald-400 bg-emerald-500/5' 
                            : 'border-amber-500/25 text-amber-400 bg-amber-500/5'
                        )}>
                          {complexity.is_optimal ? '✅ theoretical limit reached — this is optimal' : '⚠️ suboptimal code block — improvements possible'}
                        </div>

                        {/* Line-by-line list details */}
                        <div className="rounded-xl p-5 border border-white/[0.07] bg-white/[0.01]">
                          <h4 className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-3 select-none">Line-by-Line Breakdown</h4>
                          <ul className="space-y-2.5">
                            {complexity.line_by_line.map((line, i) => (
                              <li key={i} className="flex gap-2 text-xs">
                                <span className="text-violet-400 shrink-0 select-none">•</span>
                                <span className="text-slate-300 font-light">{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Tradeoffs/Alternatives */}
                        {complexity.alternatives.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-slate-300 text-xs font-bold uppercase tracking-wider select-none">Alternative Paradigms</h4>
                            {complexity.alternatives.map((alt, i) => (
                              <div key={i} className="rounded-xl p-4 border border-white/[0.07] bg-white/[0.01] hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-slate-200 text-xs font-bold">{alt.name}</span>
                                  <div className="flex gap-2 font-mono text-[10px]">
                                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{alt.time_complexity}</span>
                                    <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{alt.space_complexity}</span>
                                  </div>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed font-light">{alt.tradeoff}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
