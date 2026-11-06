/**
 * 分析引擎编排器：七步流水线
 *
 * 1 识图解析 → 2 人格侧写 → 3 阶段判定 → 4 IOI/IOD 识别 → 5 策略决策 → 6 九术匹配 → 7 话术生成
 *
 * 感知（1-4、7 的生成部分）由 LLM 完成；
 * 决策（5）与评分（4 的打分）为确定性逻辑，保证可解释、可回归。
 */
import { v4 as uuidv4 } from 'uuid';
import { parseScreenshot } from './parser.js';
import { profileRival } from './profiler.js';
import { assessStage } from './stage.js';
import { detectSignals } from './signals.js';
import { decideStrategy } from './strategy.js';
import { generateReplies } from './reply.js';
import { getModel } from './llm.js';
import type { AnalysisResult } from './types.js';

export * from './types.js';

export async function analyzeScreenshot(imageBase64: string): Promise<AnalysisResult> {
  const start = Date.now();
  let usedMock = false;

  // 1. 识图解析
  const parsed = await parseScreenshot(imageBase64);
  usedMock = usedMock || parsed.mock;
  console.log(`[analysis] dialog parsed: ${parsed.dialog.turns.length} turns (mock=${parsed.mock})`);

  // 2. 人格侧写
  const profiled = await profileRival(parsed.dialog);
  usedMock = usedMock || profiled.mock;
  console.log(`[analysis] profile: defense=${profiled.profile.defenseLevel} (mock=${profiled.mock})`);

  // 3. 阶段判定
  const staged = await assessStage(parsed.dialog, profiled.profile);
  usedMock = usedMock || staged.mock;
  console.log(`[analysis] stage: ${staged.stage} (mock=${staged.mock})`);

  // 4. IOI/IOD 识别（LLM 打标签，评分确定性计算）
  const signaled = await detectSignals(parsed.dialog);
  usedMock = usedMock || signaled.mock;
  console.log(`[analysis] signals: net=${signaled.summary.netScore} streak=${signaled.summary.iodStreak} (mock=${signaled.mock})`);

  // 5. 策略决策（规则引擎，确定性）
  const decision = decideStrategy({
    stage: staged.stage,
    profile: profiled.profile,
    summary: signaled.summary,
  });
  console.log(`[analysis] decision: ${decision.strategyLabel} via rule ${decision.ruleId}`);

  // 6-7. 九术匹配 + 话术生成
  const replies = await generateReplies({
    dialog: parsed.dialog,
    profile: profiled.profile,
    stage: staged.stage,
    stageReason: staged.stageReason,
    summary: signaled.summary,
    decision,
  });
  usedMock = usedMock || replies.mock;

  return {
    id: uuidv4(),
    createdAt: new Date(),
    dialog: parsed.dialog,
    profile: profiled.profile,
    stage: staged.stage,
    stageReason: staged.stageReason,
    signals: signaled.summary,
    decision,
    tactics: replies.tactics,
    suggestions: replies.suggestions,
    metadata: {
      model: getModel(),
      mock: usedMock,
      durationMs: Date.now() - start,
    },
  };
}
