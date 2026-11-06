/**
 * 回复思路规则引擎
 *
 * 设计目标：策略决策（进攻/退/观察）必须确定性、可解释、可回归。
 * 规则外置于 api/data/rules.yaml，支持热更新（RULES_HOT_RELOAD=true 时逐请求重读）。
 */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { Strategy } from '../analysis/types.js';

export interface RuleCondition {
  fact: string;
  op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in';
  value: number | string | Array<number | string>;
}

export interface RuleThen {
  strategy: Strategy;
  tactics: string[];
  action: string;
  requireCitation?: boolean;
}

export interface Rule {
  id: string;
  priority: number;
  description?: string;
  when: { all?: RuleCondition[] };
  then: RuleThen;
}

export interface RuleFacts {
  netScore: number;
  ioiScore: number;
  iodScore: number;
  iodStreak: number;
  stage: string;
  defenseLevel: string;
}

export interface RuleEvaluation {
  matched: boolean;
  ruleId?: string;
  reason?: string[];
  then?: RuleThen;
}

const RULES_FILE = path.join(process.cwd(), 'api', 'data', 'rules.yaml');
const HOT_RELOAD = process.env.RULES_HOT_RELOAD === 'true';

/** 兜底规则：rules.yaml 缺失/解析失败时使用 */
const FALLBACK_RULES: Rule[] = [
  {
    id: 'fallback-hold',
    priority: 0,
    description: '规则文件不可用时兜底',
    when: {},
    then: {
      strategy: 'hold',
      tactics: ['故事植入'],
      action: '延续话题，做价值展示',
    },
  },
];

let cachedRules: Rule[] | null = null;
let cachedMtime = 0;

function loadRules(): Rule[] {
  try {
    if (!HOT_RELOAD && cachedRules) {
      return cachedRules;
    }
    if (!fs.existsSync(RULES_FILE)) {
      console.warn('rules.yaml not found, using fallback rules');
      return FALLBACK_RULES;
    }
    const mtime = fs.statSync(RULES_FILE).mtimeMs;
    if (!HOT_RELOAD && cachedRules && mtime === cachedMtime) {
      return cachedRules;
    }
    const parsed = yaml.load(fs.readFileSync(RULES_FILE, 'utf-8')) as { rules?: Rule[] };
    const rules = (parsed?.rules || []).filter(r => r && r.id && r.then);
    if (rules.length === 0) {
      return FALLBACK_RULES;
    }
    rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    cachedRules = rules;
    cachedMtime = mtime;
    console.log(`Loaded ${rules.length} rules from rules.yaml`);
    return rules;
  } catch (error) {
    console.error('Failed to load rules.yaml, using fallback:', error);
    return cachedRules || FALLBACK_RULES;
  }
}

function compare(op: RuleCondition['op'], actual: number | string, expected: RuleCondition['value']): boolean {
  switch (op) {
    case 'gt': return Number(actual) > Number(expected);
    case 'gte': return Number(actual) >= Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    default: return false;
  }
}

function matchConditions(conditions: RuleCondition[] | undefined, facts: RuleFacts): string[] | null {
  if (!conditions || conditions.length === 0) {
    return [];
  }
  const reasons: string[] = [];
  for (const c of conditions) {
    const actual = (facts as unknown as Record<string, number | string>)[c.fact];
    if (actual === undefined || !compare(c.op, actual, c.value)) {
      return null;
    }
    reasons.push(`${c.fact}(${String(actual)}) ${c.op} ${JSON.stringify(c.value)}`);
  }
  return reasons;
}

/**
 * 按优先级降序评估，返回首个全部条件满足的规则。
 */
export function evaluate(facts: RuleFacts): RuleEvaluation {
  const rules = loadRules();
  for (const rule of rules) {
    const reasons = matchConditions(rule.when?.all, facts);
    if (reasons !== null) {
      return {
        matched: true,
        ruleId: rule.id,
        reason: reasons,
        then: rule.then,
      };
    }
  }
  return { matched: false };
}

export function listRules(): Rule[] {
  return loadRules();
}
