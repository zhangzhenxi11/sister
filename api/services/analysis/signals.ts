/**
 * 第 4 步：IOI / IOD 信号识别
 *
 * 感知与决策分离：LLM 只负责给每轮消息打信号标签（感知），
 * 评分与连续 IOD 计数由本模块确定性计算（决策输入），不允许 LLM 直接给结论分。
 */
import { chatJSON } from './llm.js';
import type { ChatTurn, ParsedDialog, Signal, SignalSummary } from './types.js';

/** LLM 按轮次输出的信号标签 */
export interface TurnSignalTag {
  /** turns 数组下标（0 起） */
  index: number;
  label: 'ioi' | 'iod' | 'neutral';
  signals: Signal[];
}

const SIGNAL_TYPES = [
  'ioi_active_topic', 'ioi_ask_back', 'ioi_long_reply', 'ioi_emoji', 'ioi_prompt_reply',
  'iod_short_reply', 'iod_slow_reply', 'iod_no_ask', 'iod_cold_tone',
];

const MOCK_TAGS: TurnSignalTag[] = [
  {
    index: 1,
    label: 'iod',
    signals: [
      { type: 'iod_no_ask', direction: 'iod', evidence: '「哈哈最近有点忙，看情况吧」未接邀约、不接话', weight: 1 },
    ],
  },
  {
    index: 3,
    label: 'iod',
    signals: [
      { type: 'iod_short_reply', direction: 'iod', evidence: '「嗯」单字敷衍', weight: 2 },
    ],
  },
  {
    index: 5,
    label: 'iod',
    signals: [
      { type: 'iod_short_reply', direction: 'iod', evidence: '「哦哦」敷衍、无延展', weight: 2 },
      { type: 'iod_cold_tone', direction: 'iod', evidence: '对旧话题无兴趣反馈，冷淡收尾', weight: 1 },
    ],
  },
];

const MOCK_ASSESSMENT = '对方连续敷衍短回、未接邀约，IOD 信号明显，近期不宜推进';

function normalizeTag(raw: any, turns: ChatTurn[]): TurnSignalTag | null {
  const index = Number(raw?.index);
  if (!Number.isInteger(index) || index < 0 || index >= turns.length) {
    return null;
  }
  const label = ['ioi', 'iod', 'neutral'].includes(raw?.label) ? raw.label : 'neutral';
  const signals: Signal[] = Array.isArray(raw?.signals)
    ? raw.signals
        .filter((s: any) => s && SIGNAL_TYPES.includes(s.type))
        .map((s: any) => ({
          type: s.type,
          direction: String(s.type).startsWith('ioi') ? ('ioi' as const) : ('iod' as const),
          evidence: String(s.evidence ?? '').slice(0, 120),
          weight: Math.min(3, Math.max(1, Number(s.weight) || 1)),
        }))
    : [];
  return { index, label, signals };
}

/** 尾部连续 IOD 轮数：rival 轮 label=iod 连续计数，中间的我方轮次跳过，遇到 ioi/无 rival 轮为止 */
export function computeIodStreak(tags: TurnSignalTag[], turns: ChatTurn[]): number {
  const byIndex = new Map(tags.map(t => [t.index, t]));
  let streak = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].speaker !== 'rival') continue;
    const tag = byIndex.get(i);
    if (tag?.label === 'iod') {
      streak++;
    } else if (tag?.label === 'ioi') {
      break;
    } else {
      break;
    }
  }
  return streak;
}

export async function detectSignals(dialog: ParsedDialog): Promise<{ summary: SignalSummary; mock: boolean }> {
  const { data, mock } = await chatJSON<{ tags: TurnSignalTag[]; assessment: string }>({
    label: 'analysis/signals',
    system: `你是两性对话信号识别器。IOI=兴趣指标，IOD=无兴趣指标。只输出 JSON。`,
    user: `对话记录（index 为消息序号）：
${dialog.turns.map((t, i) => `#${i} [${t.speaker === 'user' ? '我方' : '对方'}] ${t.text}${t.timeHint ? `（${t.timeHint}）` : ''}`).join('\n')}

逐轮分析"对方"消息，输出 JSON：
{
  "tags": [
    { "index": 消息序号, "label": "ioi|iod|neutral", "signals": [ { "type": "信号类型", "evidence": "证据（引用原话）", "weight": 1或2 } ] }
  ],
  "assessment": "信号总评，一句话"
}
信号类型只能是：${SIGNAL_TYPES.join(' / ')}
要求：
1. 只给 speaker=rival 的轮次打 ioi/iod 标签，我方轮次 label=neutral、signals 为空数组；
2. weight：强信号（明确敷衍/明确主动）=2，一般=1；
3. evidence 必须引用原话，禁止臆测截图中不存在的信息；
4. 只输出 JSON。`,
    temperature: 0.2,
    mock: { tags: MOCK_TAGS, assessment: MOCK_ASSESSMENT },
  });

  const tags = Array.isArray(data?.tags)
    ? data.tags.map(t => normalizeTag(t, dialog.turns)).filter((t): t is TurnSignalTag => t !== null)
    : [];

  const allSignals = tags.flatMap(t => t.signals);
  const ioi = allSignals.filter(s => s.direction === 'ioi');
  const iod = allSignals.filter(s => s.direction === 'iod');
  const ioiScore = ioi.reduce((sum, s) => sum + s.weight, 0);
  const iodScore = iod.reduce((sum, s) => sum + s.weight, 0);
  const iodStreak = computeIodStreak(tags, dialog.turns);

  return {
    summary: {
      ioi,
      iod,
      ioiScore,
      iodScore,
      netScore: ioiScore - iodScore,
      iodStreak,
      assessment: String(data?.assessment ?? ''),
    },
    mock,
  };
}
