"use client";

import { useState, FormEvent, useRef } from "react";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { searchProblems } from "@/lib/api";
import { Sparkles, Brain, ArrowRight } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const SUGGESTIONS = [
  "Medium array questions asked at Amazon",
  "Hard graph problems with DP",
  "String manipulation for Google",
  "Easy questions for beginners",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [queryExpansions, setQueryExpansions] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger search execution
  const executeSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await searchProblems(searchQuery);
      if (res.success && res.data) {
        setResults(res.data);
        setQueryExpansions(res.query_expansions || []);
      } else {
        setResults([]);
        setQueryExpansions([]);
      }
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestClick = (suggestQuery: string) => {
    setQuery(suggestQuery);
    executeSearch(suggestQuery);
  };

  // GSAP animations
  useGSAP(() => {
    // 1. Header fade-down
    gsap.fromTo(
      ".search-header",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );

    // 2. Search bar slide-in
    gsap.fromTo(
      ".search-bar-container",
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.1 }
    );

    // 3. Suggestions stagger
    gsap.fromTo(
      ".suggest-card-anim",
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power2.out", delay: 0.15 }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto space-y-6 text-foreground">
      {/* Glow Effect */}
      <div className="absolute -top-32 -right-32 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="search-header border-b border-border/40 pb-6 text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Semantic Search</h1>
          <p className="text-sm text-muted font-light mt-1">
            Describe the type of problem you want to solve in natural language. We&apos;ll find the closest matches using AI.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface/40 text-[10px] uppercase tracking-widest text-muted font-mono select-none">
          <Sparkles className="h-3 w-3 text-muted shrink-0" />
          Gemini AI
        </div>
      </div>

      {/* Search Input Container */}
      <div className="search-bar-container py-4">
        <SearchBar query={query} setQuery={setQuery} onSearch={handleSearch} loading={loading} />
      </div>

      {/* Results / Suggestions Area */}
      <div className="pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted space-y-4 select-none">
            <Brain className="h-10 w-10 animate-pulse text-foreground/40" />
            <p className="animate-pulse text-xs uppercase tracking-widest font-mono text-muted">
              Expanding queries and searching semantic vectors...
            </p>
          </div>
        ) : results !== null ? (
          <SearchResults results={results} queryExpansions={queryExpansions} />
        ) : (
          <div className="space-y-4">
            <div className="text-left border-b border-border/30 pb-2 select-none">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Suggested Prompts
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {SUGGESTIONS.map((suggest, i) => (
                <div
                  key={i}
                  onClick={() => handleSuggestClick(suggest)}
                  className="glass-card p-4 cursor-pointer hover:bg-surface-elevated/40 border border-border/50 hover:scale-[1.02] transition-all duration-300 flex items-center justify-between group text-left select-none suggest-card-anim"
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
  );
}
