'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import {
  getProblemExplanation,
  getProblemCode,
  getProblemHints,
  getProblemComplexity,
  getSimilarProblems,
  isQuotaError,
  type QuotaError,
} from '@/lib/api';

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
  code_source: 'database' | 'llm_generated' | 'llm_translated';
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

interface Problem {
  id: number | string;
  title: string;
  difficulty?: string;
  topic_tags?: string[];
  platform?: 'leetcode' | 'codeforces';
}

interface AssistantDrawerProps {
  problem: Problem | null;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'explain' | 'dryrun' | 'code' | 'hints' | 'complexity';

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
  Easy: 'text-emerald-400',
  Medium: 'text-amber-400',
  Hard: 'text-red-400',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function QuotaBanner({ error, onUpgrade }: { error: QuotaError; onUpgrade: () => void }) {
  const resetsAt = error.resets_at
    ? new Date(error.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'tomorrow';

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl"
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
          className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105"
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
  // Replace literal escaped \n with actual newlines to support both types of formats
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
    // Copy the code with unescaped newlines
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
          className="text-xs px-3 py-1 rounded-lg transition-colors"
          style={{ background: copied ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)', color: copied ? '#34d399' : '#94a3b8' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed"
        style={{ background: '#0b0b14', maxHeight: '420px', color: '#f8f8f2' }}>
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AssistantDrawer({ problem, isOpen, onClose }: AssistantDrawerProps) {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('explain');
  
  const availableLanguages = problem?.platform === 'codeforces' ? CF_LANGUAGES : ALL_LANGUAGES;
  const [language, setLanguage] = useState(problem?.platform === 'codeforces' ? 'cpp' : 'python');

  // Reset language if platform changes
  useEffect(() => {
    setLanguage(problem?.platform === 'codeforces' ? 'cpp' : 'python');
  }, [problem?.platform]);

  // Feature states
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainQuota, setExplainQuota] = useState<QuotaError | null>(null);

  const [codeData, setCodeData] = useState<{code: string; code_source: 'database' | 'llm_generated' | 'llm_translated'} | null>(null);
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

  // Reset state when problem changes
  useEffect(() => {
    if (problem) {
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
      setActiveTab('explain');
      setLanguage(problem.platform === 'codeforces' ? 'cpp' : 'python');
    }
  }, [problem?.id, problem?.platform]);

  const fetchFromExtension = async (targetLang: string) => {
    if (problem?.platform !== 'codeforces') return undefined;
    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
    if (!extensionId) return undefined;
    
    try {
      const response = await chrome.runtime.sendMessage(extensionId, {
        action: 'GET_CF_SUBMISSION_CODE',
        problemId: problem.id,
        language: targetLang
      });
      return response?.success ? { code: response.code, lang: response.scrapedLanguage } : undefined;
    } catch (error) {
      console.error('Failed to fetch from CF extension', error);
      return undefined;
    }
  };

  const fetchExplanation = useCallback(async (lang: string) => {
    if (!problem) return;
    setExplainLoading(true);
    setExplainError(null);
    setExplainQuota(null);
    try {
      const token = await getToken();
      // Use extension as fallback for Codeforces
      const extensionData = await fetchFromExtension(lang);
      const result = await getProblemExplanation(
        problem.id, 
        lang, 
        token, 
        problem.platform || 'leetcode', 
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
      setExplainError(e.message);
    } finally {
      setExplainLoading(false);
    }
  }, [problem, getToken, codeData]);

  const fetchCode = useCallback(async (lang: string) => {
    if (!problem) return;
    setCodeLoading(true);
    setCodeQuota(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const extensionData = await fetchFromExtension(lang);
      const result = await getProblemCode(
        problem.id, 
        lang, 
        token, 
        problem.platform || 'leetcode',
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
  }, [problem, getToken]);

  const loadSimilarProblems = useCallback(async () => {
    if (!problem) return;
    setSimilarLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await getSimilarProblems(problem.id, token, problem.platform || 'leetcode');
      if (!isQuotaError(result)) {
        setSimilar(result);
      }
    } catch (e: any) {
      console.error('Similar problems error:', e);
    } finally {
      setSimilarLoading(false);
    }
  }, [problem, getToken]);

  const fetchHint = useCallback(async (level: 1 | 2 | 3) => {
    if (!problem) return;
    setHintLoading(prev => ({ ...prev, [level]: true }));
    setHintQuota(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await getProblemHints(problem.id, level, token, problem.platform || 'leetcode');
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
  }, [problem, getToken]);

  const fetchComplexity = useCallback(async (lang: string) => {
    if (!problem) return;
    setComplexityLoading(true);
    setComplexityQuota(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await getProblemComplexity(problem.id, lang, token, problem.platform || 'leetcode');
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
  }, [problem, getToken]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setExplanation(null);
    setCodeData(null);
    setComplexity(null);
    setExplainQuota(null);
    setCodeQuota(null);
    setComplexityQuota(null);
  };

  const goToBilling = () => { window.location.href = '/settings/billing'; };

  if (!isOpen || !problem) return null;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'explain', label: 'Explain', icon: '💡' },
    { id: 'dryrun', label: 'Dry Run', icon: '🔄' },
    { id: 'code', label: 'Code', icon: '⌨️' },
    { id: 'hints', label: 'Hints', icon: '🔑' },
    { id: 'complexity', label: 'Complexity', icon: '📊' },
  ];

  const codeSource = codeData?.code_source || explanation?.code_source;
  const codeSourceLabel = codeSource === 'database' ? '✅ Verified DB' : 
                          codeSource === 'scraped_cf' ? '🌐 Scraped from CF' : 
                          codeSource === 'llm_translated' ? '🔀 AI Translated' : '✨ AI Generated';

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden"
        style={{
          width: 'min(680px, 95vw)',
          background: 'linear-gradient(180deg, #0f0f1e 0%, #0a0a16 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          .fade-in { animation: fadeIn 0.3s ease-out; }
        `}</style>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.07]"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-violet-400 text-xs font-medium tracking-wider uppercase">AI Assistant</span>
              <span className="text-white/20">·</span>
              <span className="text-slate-400 text-xs">#{problem.id}</span>
            </div>
            <h2 className="text-white font-bold text-lg leading-tight truncate">{problem.title}</h2>
            <div className="flex items-center gap-3 mt-2">
              {problem.difficulty && (
                <span className={`text-xs font-semibold ${DIFFICULTY_COLORS[problem.difficulty] || 'text-slate-400'}`}>
                  {problem.difficulty}
                </span>
              )}
              {(problem.topic_tags || []).slice(0, 3).map(t => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-slate-400">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4">
            {/* Language selector */}
            <select
              value={language}
              onChange={e => handleLanguageChange(e.target.value)}
              className="text-xs rounded-lg border border-white/10 px-3 py-2 text-slate-300 focus:outline-none focus:border-violet-500 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              {availableLanguages.map(l => (
                <option key={l.value} value={l.value} style={{ background: '#1a1a2e' }}>{l.label}</option>
              ))}
            </select>

            <button onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-white/[0.07]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-lg transition-all duration-150 relative"
              style={{
                color: activeTab === tab.id ? '#a78bfa' : '#64748b',
                background: activeTab === tab.id ? 'rgba(139,92,246,0.1)' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #8b5cf6' : '2px solid transparent',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── EXPLAIN TAB ── */}
          {activeTab === 'explain' && (
            <div className="relative fade-in">
              {explainQuota && <QuotaBanner error={explainQuota} onUpgrade={goToBilling} />}
              {!explanation && !explainLoading && !explainQuota && (
                <div className="text-center py-10">
                  <div className="text-5xl mb-4">💡</div>
                  <p className="text-slate-300 font-medium mb-1">Ready to explain this problem</p>
                  <p className="text-slate-500 text-sm mb-6">Get an analogy, approach steps, and deep breakdown</p>
                  <button
                    onClick={() => fetchExplanation(language)}
                    className="px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
                  >
                    Generate Explanation ✨
                  </button>
                </div>
              )}
              {explainLoading && <LoadingSpinner label="Generating explanation..." />}
              {explainError && (
                <div className="text-red-400 text-sm text-center py-8">{explainError}</div>
              )}
              {explanation && (
                <div className="space-y-5 fade-in">
                  {/* Analogy Card */}
                  <div className="rounded-xl p-5 border border-violet-500/20"
                    style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.15), rgba(59,130,246,0.1))' }}>
                    <h3 className="text-violet-300 font-semibold text-sm mb-3 flex items-center gap-2">
                      <span>🎯</span> Real-World Analogy
                    </h3>
                    <p className="text-slate-200 text-sm leading-relaxed">{explanation.analogy}</p>
                  </div>

                  {/* Approach Steps */}
                  <div className="rounded-xl p-5 border border-white/[0.07]"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <h3 className="text-blue-300 font-semibold text-sm mb-4 flex items-center gap-2">
                      <span>📋</span> Algorithm Steps
                    </h3>
                    <ol className="space-y-3">
                      {explanation.approach_steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                            {i + 1}
                          </span>
                          <span className="text-slate-300 leading-relaxed pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Complexity badges */}
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-xl p-4 border border-white/[0.07] text-center"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-xs text-slate-500 mb-1">Time Complexity</div>
                      <div className="text-emerald-400 font-bold font-mono">{explanation.time_complexity}</div>
                    </div>
                    <div className="flex-1 rounded-xl p-4 border border-white/[0.07] text-center"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-xs text-slate-500 mb-1">Space Complexity</div>
                      <div className="text-blue-400 font-bold font-mono">{explanation.space_complexity}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DRY RUN TAB ── */}
          {activeTab === 'dryrun' && (
            <div className="fade-in">
              {!explanation && (
                <div className="text-center py-10 text-slate-400 text-sm">
                  Generate an explanation first from the Explain tab.
                </div>
              )}
              {explanation && (
                <div className="space-y-3">
                  <p className="text-slate-400 text-xs mb-4">
                    Step-by-step variable trace on the first sample test case
                  </p>
                  {explanation.dry_run.map((step, i) => (
                    <div key={i} className="rounded-xl p-4 border border-white/[0.07] flex gap-4"
                      style={{ background: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                          style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
                          {step.iteration}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-200 text-sm mb-1">{step.action}</div>
                        <code className="text-xs text-emerald-400 font-mono block truncate">{step.state}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CODE TAB ── */}
          {activeTab === 'code' && (
            <div className="fade-in space-y-4">
              {!codeData && !codeLoading && !codeQuota && (
                <div className="text-center py-10">
                  <div className="text-5xl mb-4">⌨️</div>
                  <p className="text-slate-300 font-medium mb-6">Get the solution code in {availableLanguages.find(l => l.value === language)?.label}</p>
                  <button
                    onClick={() => fetchCode(language)}
                    className="px-6 py-3 rounded-xl font-semibold text-sm hover:scale-105 transition-all duration-200"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
                  >
                    Generate Code ✨
                  </button>
                </div>
              )}
              {codeLoading && <LoadingSpinner label={`Generating ${availableLanguages.find(l => l.value === language)?.label} solution...`} />}
              {codeQuota && <QuotaBanner error={codeQuota} onUpgrade={goToBilling} />}
              {codeData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-1 rounded-full border border-white/10 text-slate-400">
                      {codeSourceLabel}
                    </span>
                    <button
                      onClick={() => { setCodeData(null); fetchCode(language); }}
                      className="text-xs text-slate-400 hover:text-violet-400 transition-colors"
                    >
                      Regenerate ↺
                    </button>
                  </div>
                  <CodeBlock code={codeData.code} language={language} />
                </div>
              )}
            </div>
          )}

          {/* ── HINTS TAB ── */}
          {activeTab === 'hints' && (
            <div className="fade-in space-y-4">
              {hintQuota && <QuotaBanner error={hintQuota} onUpgrade={goToBilling} />}
              {([1, 2, 3] as const).map(level => (
                <div key={level} className="rounded-xl border border-white/[0.07] overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: level === 1 ? 'rgba(52,211,153,0.2)' : level === 2 ? 'rgba(251,191,36,0.2)' : 'rgba(139,92,246,0.2)',
                          color: level === 1 ? '#34d399' : level === 2 ? '#fbbf24' : '#c4b5fd',
                        }}>
                        Level {level}
                      </span>
                      <span className="text-xs text-slate-500">
                        {level === 1 ? 'Direction nudge' : level === 2 ? 'Key insight' : 'Near pseudocode'}
                      </span>
                    </div>
                    {level === 3 && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400">Premium</span>
                    )}
                  </div>
                  {hints[level] ? (
                    <div className="px-4 pb-4">
                      <p className="text-slate-200 text-sm leading-relaxed border-t border-white/[0.05] pt-3">
                        {hints[level]!.hint}
                      </p>
                    </div>
                  ) : (
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => fetchHint(level)}
                        disabled={hintLoading[level]}
                        className="w-full py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:scale-[1.01] disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}
                      >
                        {hintLoading[level] ? 'Generating...' : `Unlock Hint ${level} 🔓`}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── COMPLEXITY TAB ── */}
          {activeTab === 'complexity' && (
            <div className="fade-in">
              {complexityQuota && <QuotaBanner error={complexityQuota} onUpgrade={goToBilling} />}
              {!complexity && !complexityLoading && !complexityQuota && (
                <div className="text-center py-10">
                  <div className="text-5xl mb-4">📊</div>
                  <p className="text-slate-300 font-medium mb-6">Deep complexity analysis with line-by-line breakdown</p>
                  <button
                    onClick={() => fetchComplexity(language)}
                    className="px-6 py-3 rounded-xl font-semibold text-sm hover:scale-105 transition-all duration-200"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}
                  >
                    Analyze Complexity 📊
                  </button>
                </div>
              )}
              {complexityLoading && <LoadingSpinner label="Analyzing complexity..." />}
              {complexity && (
                <div className="space-y-5 fade-in">
                  {/* Big-O summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-4 border border-white/[0.07] text-center"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-xs text-slate-500 mb-1">Time</div>
                      <div className="text-emerald-400 font-bold font-mono text-lg">{complexity.time_complexity}</div>
                    </div>
                    <div className="rounded-xl p-4 border border-white/[0.07] text-center"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="text-xs text-slate-500 mb-1">Space</div>
                      <div className="text-blue-400 font-bold font-mono text-lg">{complexity.space_complexity}</div>
                    </div>
                  </div>

                  {/* Optimal badge */}
                  <div className={`text-center text-xs py-2 px-4 rounded-full border ${complexity.is_optimal ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/30 text-amber-400 bg-amber-500/10'}`}>
                    {complexity.is_optimal ? '✅ This is the optimal solution' : '⚡ More optimal solutions may exist'}
                  </div>

                  {/* Line-by-line */}
                  <div className="rounded-xl p-4 border border-white/[0.07]"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <h4 className="text-slate-300 text-xs font-semibold mb-3">Line-by-line breakdown</h4>
                    <ul className="space-y-2">
                      {complexity.line_by_line.map((line, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                          <span className="text-slate-600 flex-shrink-0">•</span>
                          <span className="text-slate-300">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Alternatives */}
                  {complexity.alternatives.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-slate-300 text-xs font-semibold">Alternative Approaches</h4>
                      {complexity.alternatives.map((alt, i) => (
                        <div key={i} className="rounded-xl p-4 border border-white/[0.07]"
                          style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-200 text-sm font-medium">{alt.name}</span>
                            <div className="flex gap-2">
                              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{alt.time_complexity}</span>
                              <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{alt.space_complexity}</span>
                            </div>
                          </div>
                          <p className="text-slate-400 text-xs leading-relaxed">{alt.tradeoff}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Similar problems strip */}
          <div className="mt-6 pt-6 border-t border-white/[0.07]">
            {!similar && !similarLoading && (
              <button
                onClick={loadSimilarProblems}
                className="w-full py-3 rounded-xl border border-white/[0.07] text-sm text-slate-300 hover:bg-white/[0.03] transition-colors flex items-center justify-center gap-2"
              >
                <span>🔍</span> Load Similar Problems
              </button>
            )}
            
            {similarLoading && <LoadingSpinner label="Finding similar problems..." />}

            {similar && similar.problems.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-400 font-semibold">Study Next</span>
                  <span className="text-xs text-slate-600">· {similar.reasoning}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {similar.problems.map((slug) => (
                    <a
                      key={slug}
                      href={`https://leetcode.com/problems/${slug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-slate-300 hover:border-violet-500/40 hover:text-violet-300 transition-all duration-150"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      {slug}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
