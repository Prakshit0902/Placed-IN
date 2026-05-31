import { Search } from "lucide-react";
import { FormEvent } from "react";

interface SearchBarProps {
  query: string;
  setQuery: (val: string) => void;
  onSearch: (e: FormEvent) => void;
  loading: boolean;
}

export function SearchBar({ query, setQuery, onSearch, loading }: SearchBarProps) {
  return (
    <form onSubmit={onSearch} className="relative group w-full max-w-2xl mx-auto">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
        <Search className={`h-5 w-5 transition-colors ${query ? "text-primary" : "text-muted group-focus-within:text-primary-light"}`} />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g., 'hard graph questions asked at Google'"
        className="w-full bg-surface border border-border/50 rounded-2xl pl-12 pr-24 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-sm group-focus-within:shadow-md"
      />
      <div className="absolute inset-y-2 right-2 flex items-center">
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-primary hover:bg-primary-light text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}
