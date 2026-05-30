import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'leetcode_problems';

export const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

/**
 * Matches the ACTUAL payload stored in the Qdrant `leetcode_problems` collection.
 * These fields were set during ingestion in `ingest_to_qdrant_local.ipynb`.
 *
 * NOTE: `company`, `frequency`, and `acceptance` data lives in
 * Supabase `lc_company_questions` — NOT in Qdrant.
 */
export interface QdrantQuestionPayload {
  id: number;
  title: string;
  slug: string;
  difficulty: string; // "Easy" | "Medium" | "Hard"
  category: string;   // "Algorithms" | "Database" | "JavaScript" | etc.
  topic_tags: string[];
}

/**
 * Scroll Qdrant collection with payload-level filters.
 * No vector search — pure metadata filtering.
 */
export async function scrollQuestions(params: {
  difficulty?: string;
  topicTags?: string[];
  limit?: number;
}): Promise<QdrantQuestionPayload[]> {
  const { difficulty, topicTags, limit = 100 } = params;

  const mustFilters: any[] = [];

  if (difficulty) {
    mustFilters.push({
      key: 'difficulty',
      match: { value: difficulty },
    });
  }

  if (topicTags && topicTags.length > 0) {
    // Each tag is an "any" match — at least one of the provided tags must be present
    mustFilters.push({
      key: 'topic_tags',
      match: { any: topicTags },
    });
  }

  try {
    const results = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: mustFilters.length > 0 ? { must: mustFilters } : undefined,
      limit,
      with_payload: true,
      with_vector: false,
    });

    const questions: QdrantQuestionPayload[] = [];

    if (results.points) {
      for (const point of results.points) {
        const payload = point.payload as Record<string, any>;
        questions.push({
          id: payload.id ?? (typeof point.id === 'number' ? point.id : 0),
          title: payload.title ?? '',
          slug: payload.slug ?? '',
          difficulty: payload.difficulty ?? 'Medium',
          category: payload.category ?? 'Algorithms',
          topic_tags: payload.topic_tags ?? [],
        });
      }
    }

    return questions;
  } catch (error) {
    console.error('Qdrant scroll error:', error);
    return [];
  }
}

/**
 * Perform semantic (vector) search against the collection.
 * Requires a pre-computed query vector (384-dim for bge-small-en-v1.5).
 */
export async function semanticSearch(params: {
  queryVector: number[];
  difficulty?: string;
  topicTags?: string[];
  limit?: number;
}): Promise<QdrantQuestionPayload[]> {
  const { queryVector, difficulty, topicTags, limit = 20 } = params;

  const mustFilters: any[] = [];

  if (difficulty) {
    mustFilters.push({ key: 'difficulty', match: { value: difficulty } });
  }
  if (topicTags && topicTags.length > 0) {
    mustFilters.push({ key: 'topic_tags', match: { any: topicTags } });
  }

  try {
    const results = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryVector,
      filter: mustFilters.length > 0 ? { must: mustFilters } : undefined,
      limit,
      with_payload: true,
    });

    return results.map((point) => {
      const payload = point.payload as Record<string, any>;
      return {
        id: payload.id ?? 0,
        title: payload.title ?? '',
        slug: payload.slug ?? '',
        difficulty: payload.difficulty ?? 'Medium',
        category: payload.category ?? 'Algorithms',
        topic_tags: payload.topic_tags ?? [],
      };
    });
  } catch (error) {
    console.error('Qdrant semantic search error:', error);
    return [];
  }
}