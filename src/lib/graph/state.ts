import { Annotation } from '@langchain/langgraph';
import { DebateRound } from '@/types/conversation';

/**
 * 研究总结数据结构
 */
export interface DataPoint {
  source: string;
  value: string;
  context: string;
}

export interface ResearchSummary {
  summary: string;
  key_facts: string[];
  data_points: DataPoint[];
}

/**
 * 辩论胜者类型
 */
export type DebateWinner = 'optimistic' | 'pessimistic' | 'draw';

/**
 * 乐观派数据（用于 EV 计算）
 */
export interface OptimisticData {
  probability: {
    baseRate: number;
    adjustedRate: number;
    adjustmentReason: string;
  };
  payoff: {
    upsidePotential: number;
    downsideRisk: number;
    timeframe: string;
    expectedReturn: number;
  };
  catalysts: Array<{
    description: string;
    impact: 'high' | 'medium' | 'low';
    timeline: string;
  }>;
  keyRisks: string[];
  confidenceLevel: number;
}

/**
 * 悲观派数据（用于 EV 计算）
 */
export interface PessimisticData {
  probability: {
    downsideProbability: number;
    severity: 'low' | 'medium' | 'high';
    timeline: string;
  };
  payoff: {
    upsideCap: number;
    downsideRisk: number;
    timeframe: string;
    expectedReturn: number;
  };
  riskFactors: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
    probability: number;
  }>;
  catalystsForDecline: string[];
  confidenceLevel: number;
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (event: {
  type:
    | 'analyzing'
    | 'node_start'
    | 'optimistic_output'
    | 'pessimistic_output'
    | 'stream_chunk'
    | 'complete'
    | 'agent_start'
    | 'agent_progress'
    | 'agent_done'
    | 'agent_error'
    | 'final_verdict'
    | 'direct_answer'
    | 'searching'
    | 'search_result'
    | 'search_complete'
    | 'db_query'
    | 'db_result';
  data?: {
    node?: string;
    message?: string;
    chunk?: string;
    agentId?: string;
    taskDescription?: string;
    error?: string;
    summary?: string;
    answer?: string;
    winner?: DebateWinner;
    optimisticAnswer?: string;
    pessimisticAnswer?: string;
    optimisticData?: OptimisticData | null;
    pessimisticData?: PessimisticData | null;
    [key: string]: unknown;
  };
}) => void;

/**
 * LangGraph 状态定义 - DeepAgent 简化版
 */
export const GraphAnnotation = Annotation.Root({
  // 用户输入
  question: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  // 研究总结（DeepAgent 输出）
  researchSummary: Annotation<ResearchSummary | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // 乐观派
  optimisticAnswer: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  optimisticData: Annotation<OptimisticData | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // 悲观派
  pessimisticAnswer: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  pessimisticData: Annotation<PessimisticData | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // 辩论结果
  debateWinner: Annotation<DebateWinner>({
    reducer: (prev, next) => next ?? prev,
    default: () => 'draw',
  }),
  debateSummary: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  // 辩论历史
  debateHistory: Annotation<DebateRound[]>({
    reducer: (prev, next) => {
      const result = [...prev];
      next.forEach((newRound) => {
        const existingIdx = result.findIndex((r) => r.round === newRound.round);
        if (existingIdx !== -1) {
          result[existingIdx] = { ...result[existingIdx], ...newRound };
        } else {
          result.push(newRound);
        }
      });
      return result;
    },
    default: () => [],
  }),

  // 错误信息
  errors: Annotation<string[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // 进度回调函数
  progressCallback: Annotation<ProgressCallback | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined,
  }),
});

export type GraphState = typeof GraphAnnotation.State;
