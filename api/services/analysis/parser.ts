/**
 * 第 1 步：识图解析器 v2（多图）
 *
 * 方案：本地 tesseract OCR（免费、离线）逐图识别文字 →
 *       多图 OCR 文本合并（交由 LLM 去重衔接处重叠消息）→
 *       LLM 结构化为对话 JSON（纯文本模型即可，不依赖视觉能力）→
 *       LLM 失败时降级启发式（逐行 unknown，保住原始文字）。
 */
import Tesseract from 'tesseract.js';
import { chatJSON, MOCK_MODE } from './llm.js';
import type { ChatTurn, ParsedDialog } from './types.js';

const MOCK_DIALOG: ParsedDialog = {
  userAlias: '我',
  rivalAlias: '她',
  rawText: '[mock] 对方连续敷衍，未接邀约',
  sourceImageCount: 1,
  turns: [
    { speaker: 'user', text: '周末一起去那家新开的展吗？', timeHint: '周六 14:02' },
    { speaker: 'rival', text: '哈哈最近有点忙，看情况吧', timeHint: '周六 20:41' },
    { speaker: 'user', text: '没事，你先忙，忙完喊我' },
    { speaker: 'rival', text: '嗯', timeHint: '周六 20:42' },
    { speaker: 'user', text: '对了，你上次说的那家咖啡店我去了，拉花确实不错' },
    { speaker: 'rival', text: '哦哦', timeHint: '周日 11:05' },
  ],
};

function normalizeTurn(t: any): ChatTurn {
  const speaker = t?.speaker === 'user' || t?.speaker === 'rival' ? t.speaker : 'unknown';
  return {
    speaker,
    text: String(t?.text ?? '').trim(),
    timeHint: t?.timeHint ? String(t.timeHint) : undefined,
    isMedia: Boolean(t?.isMedia),
  };
}

function toDataUrl(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  const mime = base64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

/** 本地 OCR 单张截图（tesseract 支持 data URL 直读） */
async function ocrImage(base64: string): Promise<string> {
  const result = await Tesseract.recognize(toDataUrl(base64), 'chi_sim+eng', {
    logger: () => {},
  });
  return (result.data.text || '').trim();
}

/** 启发式降级：OCR 文本逐行转为 unknown 轮次，保住原始内容 */
function heuristicDialog(ocrBlocks: string[]): ParsedDialog {
  const turns: ChatTurn[] = [];
  ocrBlocks.forEach((text) => {
    text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^[\d:：\-—·\s]+$/.test(l)) // 去掉纯时间/分隔行
      .forEach(line => turns.push({ speaker: 'unknown', text: line }));
  });
  return {
    userAlias: '我方',
    rivalAlias: '对方',
    rawText: ocrBlocks.join('\n---\n'),
    sourceImageCount: ocrBlocks.length,
    turns,
  };
}

export async function parseScreenshots(
  imagesBase64: string[],
): Promise<{ dialog: ParsedDialog; mock: boolean }> {
  if (imagesBase64.length === 0) {
    throw new Error('请至少上传一张截图');
  }

  if (MOCK_MODE) {
    console.log(`[mock-llm] analysis/parser: skipped (OCR+vision), ${imagesBase64.length} image(s)`);
    return { dialog: { ...MOCK_DIALOG, sourceImageCount: imagesBase64.length }, mock: true };
  }

  // 1. 逐图本地 OCR
  const ocrBlocks: string[] = [];
  for (let i = 0; i < imagesBase64.length; i++) {
    try {
      const text = await ocrImage(imagesBase64[i]);
      ocrBlocks.push(text);
      console.log(`[analysis] OCR image ${i + 1}/${imagesBase64.length}: ${text.length} chars`);
    } catch (error: any) {
      console.error(`[analysis] OCR image ${i + 1} failed:`, error?.message);
      ocrBlocks.push('');
    }
  }

  const combined = ocrBlocks
    .map((t, i) => `【截图 ${i + 1}】\n${t}`)
    .join('\n\n')
    .trim();

  if (!combined.replace(/【截图 \d+】/g, '').trim()) {
    throw new Error('未能从截图中识别到文字，请换更清晰的截图');
  }

  // 2. LLM 结构化（多图合并 + 去重衔接处重叠消息）
  const { data, mock } = await chatJSON<Record<string, unknown>>({
    label: 'analysis/parser',
    system: '你是聊天截图解析器。输入是多张截图的 OCR 文本（可能有错字、噪声、时间戳行）。只输出 JSON。',
    user: `以下是 ${imagesBase64.length} 张聊天截图的 OCR 文本（按时间顺序排列）：
${combined}

请还原为完整对话，严格按以下 JSON 输出：
{
  "userAlias": "我方（右侧气泡）的备注名，OCR 中通常靠右或带昵称",
  "rivalAlias": "对方（左侧气泡）的备注名",
  "turns": [ { "speaker": "user|rival|unknown", "text": "消息文本", "timeHint": "可见时间提示，无则空字符串", "isMedia": false } ]
}
要求：
1. 按时间顺序合并所有截图的消息；相邻截图衔接处如有重复消息（同一句话出现两次），只保留一次；
2. 每条消息一条；图片/表情包用 isMedia=true 且 text 简述（如 "[表情包]"）；
3. OCR 噪声行（电量、时间栏、输入法候选词）请剔除；
4. 无法判定说话人的用 unknown；
5. 只输出 JSON。`,
    temperature: 0.1,
    maxTokens: 2500,
    mock: null,
  });

  if (mock || !data) {
    // LLM 不可用：启发式降级
    console.warn('[analysis] LLM 结构化失败，使用启发式降级');
    return { dialog: heuristicDialog(ocrBlocks), mock: true };
  }

  const turns = Array.isArray(data?.turns) ? data.turns.map(normalizeTurn).filter(t => t.text) : [];
  if (turns.length === 0) {
    return { dialog: heuristicDialog(ocrBlocks), mock: true };
  }

  const dialog: ParsedDialog = {
    userAlias: String(data?.userAlias ?? '我方'),
    rivalAlias: String(data?.rivalAlias ?? '对方'),
    rawText: combined,
    sourceImageCount: imagesBase64.length,
    turns,
  };
  return { dialog, mock: false };
}
