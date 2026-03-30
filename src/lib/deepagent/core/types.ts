/**
 * DeepAgent 核心类型定义
 * 
 * 定义 DeepAgent 的状态、决策、观察和执行相关的所有类型
 */

import { ChatOpenAI } from '@langchain/openai';

// ==================== Skill 相关类型 ====================

/**
 * Skill 输入基础接口
 */
export interface SkillInput {
  entity: string;
  context?: Record<string, any>;
  [key: string]: any;
}

/**
 * Skill 输出标准接口
 * 所有 Skill 必须返回此格式
 */
export interface SkillOutput {
  success: boolean;
  data?: any;
  error?: string;
  
  /** 数据质量置信度 0-1 */
  confidence: number;
  
  /** 字段完整度 0-1 */
  completeness: number;
  
  /** 信息缺口描述 */
  gaps: string[];
  
  /** 建议下一步行动 */
  suggestions?: string[];
  
  /** 元数据 */
  metadata?: {
    durationMs: number;
    toolsUsed: string[];
    tokensConsumed?: number;
    sources?: string[];
  };
}

/**
 * Skill 定义接口
 */
export interface Skill {
  name: string;
  description: string;
  execute: (input: any, onProgress?: (event: ProgressEvent) => void) => Promise<SkillOutput>;
}

// ==================== DeepAgent 状态类型 ====================

/**
 * 思考记录
 */
export interface Thought {
  step: number;
  content: string;
  type: 'plan' | 'analysis' | 'decision' | 'observation';
  timestamp: number;
}

/**
 * 行动记录
 */
export interface Action {
  step: number;
  skillName: string;
  input: any;
  timestamp: number;
}

/**
 * 观察记录
 */
export interface Observation {
  step: number;
  skillName: string;
  output: SkillOutput;
  timestamp: number;
}

/**
 * 上下文数据
 */
export interface AgentContext {
  /** 已收集的数据，按 skill 名称分组 */
  collectedData: Record<string, any>;
  
  /** 当前整体置信度 */
  confidence: number;
  
  /** 当前信息缺口 */
  gaps: string[];
  
  /** 已使用的 skills */
  skillsUsed: string[];
}

/**
 * DeepAgent 状态
 */
export interface DeepAgentState {
  /** 用户目标 */
  goal: string;
  
  /** 分析对象 */
  entity: string;
  
  /** 思考链 */
  thoughts: Thought[];
  
  /** 行动历史 */
  actions: Action[];
  
  /** 观察历史 */
  observations: Observation[];
  
  /** 当前上下文 */
  context: AgentContext;
  
  /** 当前步数 */
  step: number;
  
  /** 最大步数 */
  maxSteps: number;
  
  /** 状态 */
  status: 'planning' | 'acting' | 'observing' | 'complete' | 'error';
  
  /** 错误信息 */
  error?: string;
}

// ==================== 决策类型 ====================

/**
 * LLM 决策输出
 */
export interface Decision {
  /** 思考过程 */
  thought: string;
  
  /** 分析 */
  analysis?: string;
  
  /** 决策类型 */
  decision: 'continue' | 'finalize' | 'error';
  
  /** 下一步要调用的 skill */
  nextSkill: string | null;
  
  /** 调用 skill 的输入 */
  skillInput?: any;
  
  /** 决策理由 */
  reason: string;
}

// ==================== 结果类型 ====================

/**
 * DeepAgent 执行结果
 */
export interface DeepAgentResult {
  /** 是否成功 */
  success: boolean;
  
  /** 最终输出数据 */
  data: any;
  
  /** 完整思考链 */
  thoughts: Thought[];
  
  /** 执行的行动 */
  actions: Action[];
  
  /** 观察到的结果 */
  observations: Observation[];
  
  /** 使用的 skills */
  skillsUsed: string[];
  
  /** 执行步数 */
  totalSteps: number;
  
  /** 总耗时 ms */
  durationMs: number;
  
  /** 错误信息 */
  error?: string;
}

// ==================== 配置类型 ====================

/**
 * DeepAgent 配置
 */
export interface DeepAgentConfig {
  /** LLM 实例 */
  llm: ChatOpenAI;
  
  /** 最大步数 */
  maxSteps?: number;
  
  /** 置信度阈值 */
  confidenceThreshold?: number;
  
  /** 进度回调 */
  onProgress?: (event: ProgressEvent) => void;
}

/**
 * 进度事件类型
 */
export type ProgressEventType =
  | 'node_start'
  | 'thinking'
  | 'acting'
  | 'observing'
  | 'complete'
  | 'error'
  | 'searching'
  | 'search_result'
  | 'search_complete'
  | 'db_query'
  | 'db_result'
  | 'optimistic_output'
  | 'pessimistic_output'
  | 'optimistic_rebuttal'
  | 'pessimistic_rebuttal'
  | 'round_judge'
  | 'analyzing'      // 新增：分析中
  | 'skill_start'    // 新增：skill 开始
  | 'skill_complete' // 新增：skill 完成
  | 'gap_detected';  // 新增：检测到信息缺口

/**
 * 详细事件信息（用于时间线显示）
 */
export interface EventDetail {
  eventType: 'read' | 'search' | 'db_query' | 'thinking' | 'analyze' | 'skill_call' | 'complete';
  label: string;
  detail?: string;
  expandable?: boolean;
  content?: any;
  metadata?: {
    durationMs?: number;
    resultCount?: number;
    query?: string;
    tool?: string;
    gaps?: string[];
    [key: string]: any;
  };
}

/**
 * 进度事件
 */
export interface ProgressEvent {
  type: ProgressEventType;
  step: number;
  message: string;
  data?: any;

  // 新增：详细事件信息（用于时间线）
  eventDetail?: EventDetail;
}

// ==================== 辅助类型 ====================

/**
 * 观察上下文 (传给 LLM 的)
 */
export interface ObservationContext {
  step: number;
  goal: string;
  entity: string;
  actionsCount: number;
  confidence: number;
  gaps: string[];
  lastObservation?: SkillOutput;
  collectedData: Record<string, any>;
  availableSkills: string[];
  dbSchemaSummary: string;
  dbTaskList: string[];
}
