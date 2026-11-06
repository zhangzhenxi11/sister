/**
 * 第 2 步：人格侧写器
 * 基于对方消息 → RivalProfile（特质/需求/防御等级/沟通风格）
 */
import { chatJSON } from './llm.js';
import type { ParsedDialog, RivalProfile } from './types.js';

const DEFAULT_PROFILE: RivalProfile = {
  traits: ['信息不足'],
  needs: ['待观察'],
  defenseLevel: 'medium',
  communicationStyle: '样本太少，暂无法判断',
  confidence: 0.3,
};

const MOCK_PROFILE: RivalProfile = {
  traits: ['外冷内热', '防备心重', '节奏自控'],
  needs: ['被认可', '情绪价值', '掌控感'],
  defenseLevel: 'high',
  communicationStyle: '回复简短慢热，言语保留，不接邀约但偶尔释放细节',
  confidence: 0.72,
};

function normalizeProfile(raw: any): RivalProfile {
  const defense = ['low', 'medium', 'high'].includes(raw?.defenseLevel) ? raw.defenseLevel : 'medium';
  const confidence = Number(raw?.confidence);
  return {
    traits: Array.isArray(raw?.traits) ? raw.traits.map(String).slice(0, 6) : DEFAULT_PROFILE.traits,
    needs: Array.isArray(raw?.needs) ? raw.needs.map(String).slice(0, 4) : DEFAULT_PROFILE.needs,
    defenseLevel: defense as RivalProfile['defenseLevel'],
    communicationStyle: String(raw?.communicationStyle ?? DEFAULT_PROFILE.communicationStyle),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : DEFAULT_PROFILE.confidence,
  };
}

export async function profileRival(dialog: ParsedDialog): Promise<{ profile: RivalProfile; mock: boolean }> {
  const rivalLines = dialog.turns
    .map((t, i) => ({ t, i }))
    .filter(x => x.t.speaker === 'rival')
    .map(x => `#${x.i + 1} ${x.t.text}`);

  if (rivalLines.length === 0) {
    return { profile: DEFAULT_PROFILE, mock: true };
  }

  const { data, mock } = await chatJSON<Record<string, unknown>>({
    label: 'analysis/profiler',
    system: '你是人格侧写专家，基于聊天记录对"对方"做侧写，只输出 JSON。',
    user: `对方（${dialog.rivalAlias}）的消息：
${rivalLines.join('\n')}

结合全部对话上下文（含我方消息）：
${dialog.turns.map((t, i) => `#${i + 1} [${t.speaker}] ${t.text}`).join('\n')}

输出 JSON：
{
  "traits": ["3-5 个人格特质标签"],
  "needs": ["2-3 个核心需求点"],
  "defenseLevel": "low|medium|high（对关系的防备/矜持程度）",
  "communicationStyle": "一句话沟通风格",
  "confidence": 0到1的置信度
}
只输出 JSON。`,
    temperature: 0.4,
    mock: MOCK_PROFILE as unknown as Record<string, unknown>,
  });

  return { profile: normalizeProfile(data), mock };
}
