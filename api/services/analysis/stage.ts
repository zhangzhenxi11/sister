/**
 * 第 3 步：阶段判定器
 * 对话 + 侧写 → 关系阶段 RelationshipStage
 */
import { chatJSON } from './llm.js';
import type { ParsedDialog, RelationshipStage, RivalProfile } from './types.js';

const STAGES: RelationshipStage[] = ['陌生', '破冰', '熟悉', '升温', '暧昧', '确立'];

const MOCK_STAGE = {
  stage: '升温' as RelationshipStage,
  reason: '已有单独邀约与旧话题延续，属升温期；但对方近期 IOD 明显，推进需放缓',
};

export async function assessStage(
  dialog: ParsedDialog,
  profile: RivalProfile,
): Promise<{ stage: RelationshipStage; stageReason: string; mock: boolean }> {
  const { data, mock } = await chatJSON<{ stage: string; reason: string }>({
    label: 'analysis/stage',
    system: `你是关系阶段判定器。阶段只能是：${STAGES.join(' / ')}。只输出 JSON。`,
    user: `对话记录：
${dialog.turns.map((t, i) => `#${i + 1} [${t.speaker === 'user' ? '我方' : '对方'}] ${t.text}`).join('\n')}

对方侧写：${profile.traits.join('、')}；防御等级 ${profile.defenseLevel}。

输出 JSON：
{ "stage": "上述六个阶段之一", "reason": "判定依据，一句话" }
只输出 JSON。`,
    temperature: 0.2,
    mock: MOCK_STAGE,
  });

  const stage = STAGES.includes(data?.stage as RelationshipStage)
    ? (data.stage as RelationshipStage)
    : '破冰';
  return { stage, stageReason: String(data?.reason ?? ''), mock };
}
