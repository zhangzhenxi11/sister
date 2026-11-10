/**
 * 分析引擎核心类型定义（AnalysisResult Schema）
 *
 * 设计原则：
 * - 1-4 步（感知）由 LLM 产出，全部落在此 Schema 内，强制结构化；
 * - 第 5 步（策略决策）走确定性规则引擎，输出必须可解释（ruleId + reason）；
 * - 每条候选话术必须携带九术条目引用（tactics），保证可溯源。
 */

/** 对话轮次 */
export interface ChatTurn {
  /** user=我方（截图中靠右），rival=对方（靠左），unknown=无法判定 */
  speaker: 'user' | 'rival' | 'unknown';
  text: string;
  /** 截图中可见的时间提示，如 "昨天 22:31" */
  timeHint?: string;
  /** 该条消息是否为图片/表情包/语音条 */
  isMedia?: boolean;
}

/** 第 1 步输出：识图解析结果 */
export interface ParsedDialog {
  turns: ChatTurn[];
  /** 识别出的我方/对方称呼（备注名） */
  userAlias: string;
  rivalAlias: string;
  /** OCR / 视觉理解的原始文本备份 */
  rawText: string;
  /** 来源截图张数 */
  sourceImageCount?: number;
}

/** 第 2 步输出：对方人格侧写 */
export interface RivalProfile {
  /** 人格特质标签，如 ["外冷内热", "防备心重", "事业型"] */
  traits: string[];
  /** 需求点，如 ["被认可", "情绪价值"] */
  needs: string[];
  /** 防御等级：低 / 中 / 高 */
  defenseLevel: 'low' | 'medium' | 'high';
  /** 沟通风格概述（一句话） */
  communicationStyle: string;
  /** 侧写置信度 0-1 */
  confidence: number;
}

/** 第 3 步输出：关系阶段 */
export type RelationshipStage = '陌生' | '破冰' | '熟悉' | '升温' | '暧昧' | '确立';

/** 第 4 步：IOI（兴趣指标）/ IOD（无兴趣指标）信号 */
export type SignalType =
  | 'ioi_active_topic'   // 主动开启话题
  | 'ioi_ask_back'       // 反问 / 接话
  | 'ioi_long_reply'     // 长回复、有细节
  | 'ioi_emoji'          // 热情表情 / 语气词
  | 'ioi_prompt_reply'   // 秒回 / 回复及时
  | 'iod_short_reply'    // 敷衍短回（嗯、哦、哈哈）
  | 'iod_slow_reply'     // 慢回 / 不回
  | 'iod_no_ask'         // 不接话、不反问
  | 'iod_cold_tone';     // 冷淡语气 / 终止话题

export interface Signal {
  type: SignalType;
  direction: 'ioi' | 'iod';
  /** 证据：引用哪条消息 */
  evidence: string;
  /** 权重（默认 1，强信号 2） */
  weight: number;
}

/** 第 4 步输出：信号汇总（评分由引擎确定性计算，非 LLM） */
export interface SignalSummary {
  ioi: Signal[];
  iod: Signal[];
  ioiScore: number;
  iodScore: number;
  /** 净评分 = ioiScore - iodScore */
  netScore: number;
  /** 尾部连续 IOD 轮数（用于"连续 IOD ≥ 3 → 冷冻"规则） */
  iodStreak: number;
  /** 自然语言总评 */
  assessment: string;
}

/** 第 5 步输出：策略决策 */
export type Strategy = 'advance' | 'hold' | 'retreat_unload' | 'retreat_freeze';

export interface StrategyDecision {
  strategy: Strategy;
  /** 展示用标签：进攻·推进 / 观察·蓄能 / 退·卸防 / 退·冷冻 */
  strategyLabel: string;
  /** 具体动作指引 */
  action: string;
  /** 建议调用的九术模块名 */
  tactics: string[];
  /** 命中的规则 id（可解释、可回归） */
  ruleId: string;
  /** 命中理由（事实值说明） */
  reason: string[];
  /** 是否强制话术引用九术条目 */
  requireCitation?: boolean;
}

/** 第 6 步输出：命中的九术条目（含溯源） */
export interface TacticMatch {
  /** 条目编号：优先九术库 materialId，其次规则内战术名 */
  id: string;
  name: string;
  /** 引用内容摘要 */
  source: string;
  /** 匹配分 */
  score: number;
}

/** 第 7 步输出：候选话术 */
export interface ReplySuggestion {
  text: string;
  /** 风险说明 */
  risk: string;
  /** 引用的九术条目编号（requireCitation 时强制非空） */
  tactics: string[];
}

/** 全量分析结果 */
export interface AnalysisResult {
  id: string;
  createdAt: Date;
  /** 归属用户（登录后产生；未登录为空） */
  userId?: string;
  dialog: ParsedDialog;
  profile: RivalProfile;
  stage: RelationshipStage;
  stageReason: string;
  signals: SignalSummary;
  decision: StrategyDecision;
  tactics: TacticMatch[];
  suggestions: ReplySuggestion[];
  metadata: {
    model: string;
    mock: boolean;
    /** 降级为演示数据的环节名称列表（mock=true 时有值） */
    degradedSteps?: string[];
    durationMs: number;
  };
}

/** 用户反馈（回流规则调权） */
export interface AnalysisFeedback {
  analysisId: string;
  suggestionIndex: number;
  outcome: 'adopted' | 'edited' | 'rejected';
  editedText?: string;
  comment?: string;
  createdAt: Date;
}
