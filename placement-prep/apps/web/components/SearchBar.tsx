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
    <form onSubmit={onSearch} className="relative group w-full max-w-2xl mx-auto select-none">
      <div className="absolute inset-y-0 left-4.5 flex items-center pointer-events-none">
        <Search className={`h-5 w-5 transition-colors ${query ? "text-foreground" : "text-muted group-focus-within:text-foreground"}`} />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g., 'hard graph questions asked at Google'"
        className="w-full bg-surface/30 border border-border/50 rounded-2xl pl-12 pr-28 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/30 transition-all text-foreground placeholder:text-muted/50"
      />
      <div className="absolute inset-y-2 right-2 flex items-center">
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-foreground text-background hover:opacity-90 px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}
