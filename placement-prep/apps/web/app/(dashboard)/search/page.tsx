"use client";

import { useState, FormEvent } from "react";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { searchProblems } from "@/lib/api";
import { Sparkles, Brain } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [queryExpansions, setQueryExpansions] = useState<string[]>([]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await searchProblems(query);
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary-light text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Powered by Gemini AI
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Semantic Problem Search
        </h1>
        <p className="text-muted max-w-xl mx-auto">
          Describe the type of problem you want to solve in natural language. We'll find the closest matches using AI.
        </p>
      </div>

      <SearchBar query={query} setQuery={setQuery} onSearch={handleSearch} loading={loading} />

      <div className="pt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted space-y-4">
            <Brain className="h-10 w-10 animate-pulse text-primary/50" />
          <p className="animate-pulse">Expanding query and searching across semantic variants...</p>
          </div>
        ) : results !== null ? (
          <SearchResults results={results} queryExpansions={queryExpansions} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-12 opacity-60">
            <div className="glass-card p-4 cursor-pointer hover:bg-surface-elevated transition-colors" onClick={() => setQuery("Medium array questions asked at Amazon")}>
              <p className="text-sm">"Medium array questions asked at Amazon"</p>
            </div>
            <div className="glass-card p-4 cursor-pointer hover:bg-surface-elevated transition-colors" onClick={() => setQuery("Hard graph problems with DP")}>
              <p className="text-sm">"Hard graph problems with DP"</p>
            </div>
            <div className="glass-card p-4 cursor-pointer hover:bg-surface-elevated transition-colors" onClick={() => setQuery("String manipulation for Google")}>
              <p className="text-sm">"String manipulation for Google"</p>
            </div>
            <div className="glass-card p-4 cursor-pointer hover:bg-surface-elevated transition-colors" onClick={() => setQuery("Easy questions for beginners")}>
              <p className="text-sm">"Easy questions for beginners"</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
