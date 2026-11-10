/**
 * 分析流式调用：fetch + ReadableStream 消费 SSE（POST /api/analyze/stream）
 * 逐步回调流水线进度，最终 resolve AnalysisResult。
 */
import { compressImage, blobToBase64 } from './imageCompress';
import type { AnalysisResult } from '../../api/services/analysis/types';

export interface StepEvent {
  step: number;
  name: string;
  status: 'running' | 'done';
}

export async function analyzeWithStream(
  file: File,
  token: string | null,
  onStep: (e: StepEvent) => void,
): Promise<AnalysisResult> {
  const compressed = await compressImage(file);
  const base64 = await blobToBase64(compressed);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch('/api/analyze/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    try {
      const json = await res.json();
      if (json?.error) message = json.error;
    } catch { /* 忽略解析失败 */ }
    throw new Error(message);
  }
  if (!res.body) {
    throw new Error('当前环境不支持流式读取');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new Promise<AnalysisResult>((resolve, reject) => {
    const pump = async (): Promise<void> => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          reject(new Error('连接中断，请重试'));
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const event = part.match(/^event: (.+)$/m)?.[1]?.trim();
          const dataLine = part.match(/^data: (.+)$/m)?.[1];
          if (!event || !dataLine) continue;
          let data: unknown;
          try {
            data = JSON.parse(dataLine);
          } catch {
            continue;
          }
          if (event === 'step') {
            onStep(data as StepEvent);
          } else if (event === 'done') {
            resolve(data as AnalysisResult);
            return;
          } else if (event === 'error') {
            reject(new Error((data as { message?: string })?.message || '分析失败'));
            return;
          }
        }
      }
    };
    pump().catch(reject);
  });
}
