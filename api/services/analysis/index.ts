/**
 * 分析引擎编排器：七步流水线
 *
 * 1 识图解析 → 2 人格侧写 → 3 阶段判定 → 4 IOI/IOD 识别 → 5 策略决策 → 6 九术匹配 → 7 话术生成
 *
 * 感知（1-4、7 的生成部分）由 LLM 完成；
 * 决策（5）与评分（4 的打分）为确定性逻辑，保证可解释、可回归。
 */
import { v4 as uuidv4 } from 'uuid';
import { parseScreenshots } from './parser.js';
import { profileRival } from './profiler.js';
import { assessStage } from './stage.js';
import { detectSignals } from './signals.js';
import { decideStrategy } from './strategy.js';
import { generateReplies } from './reply.js';
import { getModel } from './llm.js';
import type { AnalysisResult } from './types.js';

export * from './types.js';

/** 流水线步骤（与 SSE 进度事件对应） */
export const PIPELINE_STEPS = [
  '识图解析',
  '人格侧写',
  '阶段判定',
  'IOI·IOD 识别',
  '策略决策',
  '九术匹配',
  '话术生成',
] as const;

export type StepStatus = 'running' | 'done';
export type OnStep = (step: number, name: string, status: StepStatus) => void;

export async function analyzeScreenshots(
  images: string[],
  onStep?: OnStep,
): Promise<AnalysisResult> {
  const start = Date.now();
  let usedMock = false;
  const step = (n: number, status: StepStatus) =>
    onStep?.(n, PIPELINE_STEPS[n - 1] || `步骤 ${n}`, status);

  // 1. 识图解析（支持多图合并）
  step(1, 'running');
  const parsed = await parseScreenshots(images);
  usedMock = usedMock || parsed.mock;
  step(1, 'done');
  console.log(`[analysis] dialog parsed: ${parsed.dialog.turns.length} turns from ${images.length} image(s) (mock=${parsed.mock})`);

  // 2. 人格侧写
  step(2, 'running');
  const profiled = await profileRival(parsed.dialog);
  usedMock = usedMock || profiled.mock;
  step(2, 'done');
  console.log(`[analysis] profile: defense=${profiled.profile.defenseLevel} (mock=${profiled.mock})`);

  // 3. 阶段判定
  step(3, 'running');
  const staged = await assessStage(parsed.dialog, profiled.profile);
  usedMock = usedMock || staged.mock;
  step(3, 'done');
  console.log(`[analysis] stage: ${staged.stage} (mock=${staged.mock})`);

  // 4. IOI/IOD 识别（LLM 打标签，评分确定性计算）
  step(4, 'running');
  const signaled = await detectSignals(parsed.dialog);
  usedMock = usedMock || signaled.mock;
  step(4, 'done');
  console.log(`[analysis] signals: net=${signaled.summary.netScore} streak=${signaled.summary.iodStreak} (mock=${signaled.mock})`);

  // 5. 策略决策（规则引擎，确定性）
  step(5, 'running');
  const decision = decideStrategy({
    stage: staged.stage,
    profile: profiled.profile,
    summary: signaled.summary,
  });
  step(5, 'done');
  console.log(`[analysis] decision: ${decision.strategyLabel} via rule ${decision.ruleId}`);

  // 6-7. 九术匹配 + 话术生成
  step(6, 'running');
  const replies = await generateReplies({
    dialog: parsed.dialog,
    profile: profiled.profile,
    stage: staged.stage,
    stageReason: staged.stageReason,
    summary: signaled.summary,
    decision,
  });
  usedMock = usedMock || replies.mock;
  step(6, 'done');
  step(7, 'running');
  step(7, 'done');

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
