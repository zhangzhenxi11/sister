import { QdrantClient } from '@qdrant/js-client-rest';
import { getMaterials } from '../data/store.js';

const qdrantHost = process.env.QDRANT_HOST || '127.0.0.1';
const qdrantPort = parseInt(process.env.QDRANT_PORT || '6333');

export const qdrantClient = new QdrantClient({
  host: qdrantHost,
  port: qdrantPort,
});

export const COLLECTION_NAME = 'emotion_ai_materials';

export async function initVectorStore(): Promise<void> {
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      });
      console.log('Collection created:', COLLECTION_NAME);
    }
  } catch (error) {
    console.error('Failed to init vector store:', error);
    throw error;
  }
}

export async function addVectors(
  materials: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>
): Promise<void> {
  const vectors = await Promise.all(
    materials.map(async (m) => {
      const embedding = await getEmbedding(m.content);
      return {
        id: m.id,
        vector: embedding,
        payload: {
          content: m.content,
          ...m.metadata,
        },
      };
    })
  );

  await qdrantClient.upsert(COLLECTION_NAME, {
    wait: true,
    points: vectors,
  });
}

export async function searchSimilar(
  query: string,
  limit: number = 5
): Promise<Array<{ id: string; content: string; score: number }>> {
  try {
    const queryEmbedding = await getEmbedding(query);

    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
    });

    return searchResult.map((r) => ({
      id: r.id as string,
      content: (r.payload as { content?: string }).content || '',
      score: r.score,
    }));
  } catch (error) {
    console.log('searchSimilar: Qdrant failed, using simple fallback');
    return simpleSearch(query, limit);
  }
}

function simpleSearch(query: string, limit: number): Array<{ id: string; content: string; score: number }> {
  const materials = getMaterials();
  console.log('simpleSearch: materials count:', materials.length);
  if (materials.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  // 分词：按每个汉字/词搜索
  const chars = queryLower.split('').filter(c => c.trim().length > 0);
  const keywords = [...new Set(chars)].filter(c => c.length > 0);
  console.log('simpleSearch: keywords:', keywords);
  
  if (keywords.length === 0) {
    return materials.slice(0, limit).map(m => ({
      id: m.id,
      content: m.content || m.summary || '',
      score: 1
    }));
  }
  
  const scored = materials.map(m => {
    let score = 0;
    const contentLower = (m.content || m.summary || '').toLowerCase();
    for (const kw of keywords) {
      if (contentLower.includes(kw)) score += 1;
    }
    // 至少匹配1个关键词就有分
    return { id: m.id, content: m.content || m.summary || '', score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, limit);
  console.log('simpleSearch: result:', result.map(r => ({ id: r.id, score: r.score, content: r.content?.slice(0, 30) })));
  return result;
 }

export async function deleteVector(id: string): Promise<void> {
  await qdrantClient.delete(COLLECTION_NAME, {
    points: [id],
  });
}

async function getEmbedding(text: string): Promise<number[]> {
  const { default: OpenAI } = await import('openai');
  
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: baseURL,
  });

  const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

  try {
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: text,
    });

    if (response.data && response.data[0]) {
      return response.data[0].embedding;
    }
    
    throw new Error('Invalid embedding response');
  } catch (error: any) {
    console.error('Embedding error:', error.message || error);
    
    console.log('Using simple hash-based embedding as fallback');
    return simpleHashEmbedding(text);
  }
}

function simpleHashEmbedding(text: string): number[] {
  const dimension = 1536;
  const embedding = new Array(dimension).fill(0);
  
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    embedding[i % dimension] += char;
    embedding[(i * 7) % dimension] += char * 0.5;
    embedding[(i * 13) % dimension] += char * 0.3;
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (magnitude || 1));
}
