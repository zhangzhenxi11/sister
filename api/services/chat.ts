import { default as OpenAI } from 'openai';
import { searchSimilar } from './vectorStore.js';
import { getMaterials } from '../data/store.js';

async function simpleSearchSimilar(query: string, limit: number): Promise<Array<{ id: string; content: string; score: number }>> {
  const materials = getMaterials();
  if (materials.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(w => w.length > 1);
  
  const scored = materials.map(m => {
    let score = 0;
    const contentLower = (m.content || m.summary || '').toLowerCase();
    for (const kw of keywords) {
      if (contentLower.includes(kw)) score += kw.length;
    }
    return { id: m.id, content: m.content || m.summary || '', score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > 0).slice(0, limit);
}

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Persona {
  id: number;
  name: string;
  description: string;
  style: string;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = `你是一个情感AI助手，专门为用户提供恋爱建议和关系指导。

请遵循以下原则：
1. 保持温暖、耐心的态度
2. 提供实用的建议，而非空洞的安慰
3. 尊重用户的感受，不评判
4. 适度引导，帮助用户自己思考
5. 保持积极但真实的态度
6. 回答应该简洁有力，避免长篇大论

你现在的角色是用户的情感顾问朋友。`;

export async function generateResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  options?: {
    persona?: Persona;
    useRag?: boolean;
    ragLimit?: number;
  }
): Promise<string> {
  const { persona, useRag = false, ragLimit = 3 } = options || {};

  let context = '';
  if (useRag) {
    try {
      const similarContent = await searchSimilar(userMessage, ragLimit);
      if (similarContent.length > 0) {
        context = `\n\n相关学习资料：\n${similarContent.map(c => `- ${c.content}`).join('\n')}`;
      }
    } catch (error) {
      console.log('Vector search failed, using simple search');
      const simpleResult = await simpleSearchSimilar(userMessage, ragLimit);
      if (simpleResult.length > 0) {
        context = `\n\n相关学习资料：\n${simpleResult.map(c => `- ${c.content}`).join('\n')}`;
      }
    }
  }

  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  if (persona?.systemPrompt) {
    systemPrompt = persona.systemPrompt;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10),
    { role: 'user', content: userMessage + context },
  ];

  const openai = getOpenAI();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await openai.chat.completions.create({
    model: model,
    messages: messages as any,
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0].message.content || '抱歉，我现在无法给出回复。';
}

export async function generatePersonaDescription(
  materialContents: string[]
): Promise<string> {
  const openai = getOpenAI();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'system',
        content: '你是一个人格塑造专家，请根据提供的学习资料，描述一个独特的AI人格特征。',
      },
      {
        role: 'user',
        content: `请根据以下学习资料，总结出一个独特的情感AI人格：
        
${materialContents.join('\n\n')}

请描述：
1. 人格名称
2. 性格特点
3. 说话风格
4. 适合的场景
5. 一个简短的系统提示词（用于对话）`,
      },
    ],
    max_tokens: 1500,
  });

  return response.choices[0].message.content || '';
}
