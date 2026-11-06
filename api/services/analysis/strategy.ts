/**
 * 第 5 步：策略决策器
 *
 * 纯确定性逻辑：事实值 → rules.yaml 规则引擎 → StrategyDecision。
 * 不使用 LLM，保证"进攻/退/观察"判定可解释、可回归。
 */
import { evaluate, type RuleFacts } from '../rules/engine.js';
import type { RivalProfile, SignalSummary, Strategy, StrategyDecision } from './types.js';

const STRATEGY_LABELS: Record<Strategy, string> = {
  advance: '进攻 · 推进',
  hold: '观察 · 蓄能',
  retreat_unload: '退 · 卸防',
  retreat_freeze: '退 · 冷冻',
};

export interface StrategyInput {
  stage: string;
  profile: RivalProfile;
  summary: SignalSummary;
}

export function decideStrategy(input: StrategyInput): StrategyDecision {
  const { stage, profile, summary } = input;
  const facts: RuleFacts = {
    netScore: summary.netScore,
    ioiScore: summary.ioiScore,
    iodScore: summary.iodScore,
    iodStreak: summary.iodStreak,
    stage,
    defenseLevel: profile.defenseLevel,
  };

  const ev = evaluate(facts);

  if (!ev.matched || !ev.then) {
    return {
      strategy: 'hold',
      strategyLabel: STRATEGY_LABELS.hold,
      action: '延续话题，做价值展示，不急着推进',
      tactics: ['故事植入'],
      ruleId: 'engine-default',
      reason: ['无任何规则命中，使用观察策略'],
      requireCitation: false,
    };
  }

  const strategy = ev.then.strategy;
  return {
    strategy,
    strategyLabel: STRATEGY_LABELS[strategy] || strategy,
    action: ev.then.action,
    tactics: ev.then.tactics || [],
    ruleId: ev.ruleId!,
    reason: [`命中规则 ${ev.ruleId}`, ...(ev.reason || [])],
    requireCitation: Boolean(ev.then.requireCitation),
  };
}
