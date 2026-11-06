/**
 * 第 6-7 步：九术匹配 + 话术生成
 *
 * 6. 按决策的战术名，从九术知识库（向量检索）找出处，强制可溯源；
 * 7. LLM 生成 2-3 条候选话术；requireCitation 时强制每条话术携带九术条目编号。
 */
import { chatJSON } from './llm.js';
import { searchSimilar } from '../vectorStore.js';
import type {
  ParsedDialog,
  RelationshipStage,
  ReplySuggestion,
  RivalProfile,
  SignalSummary,
  StrategyDecision,
  TacticMatch,
} from './types.js';

interface ReplyInput {
  dialog: ParsedDialog;
  profile: RivalProfile;
  stage: RelationshipStage;
  stageReason: string;
  summary: SignalSummary;
  decision: StrategyDecision;
}

const MOCK_SUGGESTIONS = {
  suggestions: [
    {
      text: '刚路过你说的那家店，突然想起你夸过它拉花——下次顺路帮我鉴定一下？',
      risk: '以旧话题为钩、低压模糊邀约；若对方再度敷衍，立即转入冷冻，不再追问',
    },
    {
      text: '哈哈那先不打扰你忙了，我这边也有个展要布。回头聊',
      risk: '主动收线展示稀缺性，配合冷冻策略使用；风险低但推进力弱',
    },
  ],
};

/** 第 6 步：九术知识库匹配 */
async function matchTactics(decision: StrategyDecision): Promise<TacticMatch[]> {
  const matches: TacticMatch[] = [];
  for (const name of decision.tactics) {
    try {
      const hits = await searchSimilar(name, 1);
      if (hits.length > 0) {
        matches.push({
          id: String(hits[0].id),
          name,
          source: hits[0].content.slice(0, 200),
          score: Number(hits[0].score) || 0,
        });
      } else {
        matches.push({
          id: `tactic-${name}`,
          name,
          source: `（知识库暂无「${name}」条目：请通过 /api/learn/upload 上传九术资料后重建人格/索引）`,
          score: 0,
        });
      }
    } catch (error) {
      console.error(`[analysis/reply] 战术「${name}」检索失败:`, error);
      matches.push({ id: `tactic-${name}`, name, source: '（知识库检索失败）', score: 0 });
    }
  }
  return matches;
}

function normalizeSuggestions(raw: any, citationIds: string[], requireCitation: boolean): ReplySuggestion[] {
  if (!Array.isArray(raw?.suggestions)) return [];
  return raw.suggestions
    .slice(0, 3)
    .map((s: any) => {
      const tactics = Array.isArray(s?.tactics) ? s.tactics.map(String) : [];
      const text = String(s?.text ?? '').trim();
      const risk = String(s?.risk ?? '').trim();
      if (!text) return null;
      // 强制溯源：缺引用时补齐命中的九术条目编号
      if (requireCitation && tactics.length === 0 && citationIds.length > 0) {
        tactics.push(...citationIds.slice(0, 2));
      }
      return { text, risk, tactics };
    })
    .filter((s: ReplySuggestion | null): s is ReplySuggestion => s !== null);
}

/** 第 7 步：候选话术生成 */
export async function generateReplies(input: ReplyInput): Promise<{
  tactics: TacticMatch[];
  suggestions: ReplySuggestion[];
  mock: boolean;
}> {
  const { dialog, profile, stage, stageReason, summary, decision } = input;

  const tactics = await matchTactics(decision);
  const citationIds = tactics.map(t => t.id);
  const tacticBlock = tactics
    .map((t, i) => `${i + 1}. [${t.id}] ${t.name}：${t.source}`)
    .join('\n');

  const tail = dialog.turns
    .slice(-10)
    .map(t => `[${t.speaker === 'user' ? '我方' : '对方'}] ${t.text}`)
    .join('\n');

  const { data, mock } = await chatJSON<{ suggestions: Array<{ text: string; risk: string; tactics?: string[] }> }>({
    label: 'analysis/reply',
    system: '你是话术生成器。基于分析结论生成候选回复，只输出 JSON。',
    user: `【对话近况】
${tail}

【对方侧写】${profile.traits.join('、')}；需求：${profile.needs.join('、')}；防御等级：${profile.defenseLevel}
【关系阶段】${stage}（${stageReason}）
【信号总评】${summary.assessment}（IOI ${summary.ioiScore} / IOD ${summary.iodScore} / 连续IOD ${summary.iodStreak}）
【当前策略】${decision.strategyLabel} —— ${decision.action}
【可用九术条目】
${tacticBlock || '（无）'}

生成 2-3 条候选回复，输出 JSON：
{ "suggestions": [ { "text": "候选话术", "risk": "风险说明（何时不该用）", "tactics": ["引用的条目编号"] } ] }
要求：
1. 话术必须符合当前策略，策略为退/冷冻时不要给出推进话术；
2. 每条 text 不超过 60 字，口语化，可直接发送；
3. tactics 必须填写上方九术条目的编号；
4. 只输出 JSON。`,
    temperature: 0.7,
    mock: MOCK_SUGGESTIONS,
  });

  const suggestions = normalizeSuggestions(data, citationIds, decision.requireCitation ?? true);
  return { tactics, suggestions, mock };
}
