import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'placement_questions';

export const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

export interface QuestionRecord {
  id: string;
  company: string;
  role: string;
  round: string;
  difficulty: string;
  topics: string[];
  question_text: string;
  question_url: string;
  frequency_score?: number;
  acceptance_rate?: string;
}

export async function searchQuestions(params: {
  company: string;
  role?: string;
  topics?: string[];
  difficulty?: string;
  limit?: number;
}): Promise<QuestionRecord[]> {
  const { company, role, topics, difficulty, limit = 100 } = params;

  try {
    // Use scroll to get all matching points
    const results = await qdrantClient.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'company',
            match: { value: company },
          },
        ],
      },
      limit,
      with_payload: true,
      with_vectors: false,
    });

    const questions: QuestionRecord[] = [];

    if (results.results) {
      for (const point of results.results) {
        const payload = point.payload as Record<string, any>;

        // Filter by role if specified
        if (role && payload.role !== role) continue;

        // Filter by difficulty if specified
        if (difficulty && payload.difficulty !== difficulty) continue;

        // Filter by topics if specified
        if (topics && topics.length > 0) {
          const questionTopics = (payload.topics || []).map((t: string) =>
            t.toLowerCase()
          );
          const hasMatchingTopic = topics.some(
            (topic) => questionTopics.includes(topic.toLowerCase())
          );
          if (!hasMatchingTopic) continue;
        }

        questions.push({
          id: (point.id as string) || '',
          company: payload.company || '',
          role: payload.role || 'SDE',
          round: payload.round || 'dsa',
          difficulty: payload.difficulty || 'medium',
          topics: payload.topics || [],
          question_text: payload.question_text || payload.title || '',
          question_url: payload.question_url || payload.url || '',
          frequency_score: payload.frequency_score,
          acceptance_rate: payload.acceptance_rate,
        });
      }
    }

    return questions;
  } catch (error) {
    console.error('Qdrant search error:', error);
    return [];
  }
}

export async function getQuestionsByTopics(
  company: string,
  topics: string[],
  difficulty?: string,
  limit: number = 20
): Promise<QuestionRecord[]> {
  return searchQuestions({
    company,
    topics,
    difficulty,
    limit,
  });
}