import { QdrantClient } from '@qdrant/js-client-rest';

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
