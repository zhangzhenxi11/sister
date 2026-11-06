/**
 * 分析引擎 LLM 调用封装
 *
 * - 统一 JSON Schema 输出约定（正则提取 + 解析，失败降级 mock 数据并告警）；
 * - MOCK_LLM=true 时不发起真实调用，便于离线开发与冒烟测试。
 */
import { default as OpenAI } from 'openai';

export const MOCK_MODE = process.env.MOCK_LLM === 'true';

function getOpenAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
}

export function getModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function extractJson(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export interface JSONCallOptions<T> {
  /** 日志标识 */
  label: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** MOCK / LLM 失败时的兜底数据 */
  mock: T;
}

export interface JSONCallResult<T> {
  data: T;
  mock: boolean;
}

export async function chatJSON<T>(opts: JSONCallOptions<T>): Promise<JSONCallResult<T>> {
  if (MOCK_MODE) {
    console.log(`[mock-llm] ${opts.label}: skipped`);
    return { data: opts.mock, mock: true };
  }
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1500,
    });
    const content = response.choices[0]?.message?.content || '';
    const parsed = extractJson(content);
    if (parsed === null) {
      throw new Error('LLM 未返回合法 JSON');
    }
    return { data: parsed as T, mock: false };
  } catch (error: any) {
    console.error(`[${opts.label}] LLM 调用失败，降级为 mock 数据:`, error?.message || error);
    return { data: opts.mock, mock: true };
  }
}

export interface VisionJSONOptions<T> extends JSONCallOptions<T> {
  imageBase64: string;
  detail?: 'low' | 'high';
}

export async function visionJSON<T>(opts: VisionJSONOptions<T>): Promise<JSONCallResult<T>> {
  const url = opts.imageBase64.startsWith('data:')
    ? opts.imageBase64
    : `data:image/jpeg;base64,${opts.imageBase64}`;

  if (MOCK_MODE) {
    console.log(`[mock-llm] ${opts.label}: skipped (vision)`);
    return { data: opts.mock, mock: true };
  }
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: opts.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: opts.user },
            { type: 'image_url', image_url: { url, detail: opts.detail || 'high' } },
          ],
        },
      ],
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2000,
    });
    const content = response.choices[0]?.message?.content || '';
    const parsed = extractJson(content);
    if (parsed === null) {
      throw new Error('LLM 未返回合法 JSON');
    }
    return { data: parsed as T, mock: false };
  } catch (error: any) {
    console.error(`[${opts.label}] 视觉调用失败，降级为 mock 数据:`, error?.message || error);
    return { data: opts.mock, mock: true };
  }
}
