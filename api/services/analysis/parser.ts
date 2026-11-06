/**
 * 第 1 步：识图解析器
 * 截图（base64）→ 结构化对话 ParsedDialog
 */
import { visionJSON } from './llm.js';
import type { ChatTurn, ParsedDialog } from './types.js';

const MOCK_DIALOG: ParsedDialog = {
  userAlias: '我',
  rivalAlias: '她',
  rawText: '[mock] 对方连续敷衍，未接邀约',
  turns: [
    { speaker: 'user', text: '周末一起去那家新开的展吗？', timeHint: '周六 14:02' },
    { speaker: 'rival', text: '哈哈最近有点忙，看情况吧', timeHint: '周六 20:41' },
    { speaker: 'user', text: '没事，你先忙，忙完喊我' },
    { speaker: 'rival', text: '嗯', timeHint: '周六 20:42' },
    { speaker: 'user', text: '对了，你上次说的那家咖啡店我去了，拉花确实不错' },
    { speaker: 'rival', text: '哦哦', timeHint: '周日 11:05' },
  ],
};

function normalizeTurn(t: any, index: number): ChatTurn {
  const speaker = t?.speaker === 'user' || t?.speaker === 'rival' ? t.speaker : 'unknown';
  return {
    speaker,
    text: String(t?.text ?? '').trim(),
    timeHint: t?.timeHint ? String(t.timeHint) : undefined,
    isMedia: Boolean(t?.isMedia),
  };
}

export async function parseScreenshot(imageBase64: string): Promise<{ dialog: ParsedDialog; mock: boolean }> {
  const { data, mock } = await visionJSON<ParsedDialog>({
    label: 'analysis/parser',
    imageBase64,
    detail: 'high',
    system: '你是聊天截图解析器，只输出 JSON，不要输出任何其他内容。',
    user: `识别这张聊天截图，还原对话，严格按以下 JSON 输出：
{
  "userAlias": "我方（右侧气泡）的备注名",
  "rivalAlias": "对方（左侧气泡）的备注名",
  "turns": [
    { "speaker": "user|rival|unknown", "text": "消息文本", "timeHint": "可见时间提示，无则空字符串", "isMedia": false }
  ]
}
要求：
1. 按截图从上到下（时间顺序）逐条输出；
2. 右侧气泡为 user，左侧为 rival，无法判定用 unknown；
3. 图片/表情包/语音条：isMedia=true，text 简述内容（如 "[表情包：狗头]"）；
4. 只输出 JSON。`,
    mock: MOCK_DIALOG,
  });

  const dialog: ParsedDialog = {
    userAlias: String(data?.userAlias ?? '我'),
    rivalAlias: String(data?.rivalAlias ?? '对方'),
    rawText: String(data?.rawText ?? ''),
    turns: Array.isArray(data?.turns) ? data.turns.map(normalizeTurn) : [],
  };

  if (dialog.turns.length === 0) {
    throw new Error('未能从截图中识别出任何对话内容');
  }
  return { dialog, mock };
}
