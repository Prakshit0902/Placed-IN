// User types
export interface User {
  id: string;
  email: string;
  name: string;
  college_id?: string;
  role: "student" | "admin" | "superadmin";
}

// Search types
export interface SearchQuery {
  query: string;
  company?: string;
  role?: string;
  difficulty?: "easy" | "medium" | "hard";
  limit?: number;
}

export interface SearchResult {
  id: string;
  company: string;
  role: string;
  question: string;
  difficulty: string;
  round: string;
  year: number;
  similarity_score: number;
}

// College types
export interface College {
  id: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  student_count: number;
}// User types
export interface User {
  id: string;
  email: string;
  name: string;
  college_id?: string;
  role: "student" | "admin" | "superadmin";
}

// Search types
export interface SearchQuery {
  query: string;
  company?: string;
  role?: string;
  difficulty?: "easy" | "medium" | "hard";
  limit?: number;
}

export interface SearchResult {
  id: string;
  company: string;
  role: string;
  question: string;
  difficulty: string;
  round: string;
  year: number;
  similarity_score: number;
}

// College types
export interface College {
  id: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  student_count: number;
}
