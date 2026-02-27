import { Annotation } from '@langchain/langgraph';
import { SearchResult } from '@/types/mcp';

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
 * LangGraph 状态定义
 * 包含整个辩论流程的所有状态字段
 */
export const GraphAnnotation = Annotation.Root({
  // 用户输入
  question: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  // 搜索结果 - 使用具体类型替代 any[]
  searchResults: Annotation<SearchResult[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  // 研究总结
  researchSummary: Annotation<ResearchSummary | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  // 搜索引擎使用统计
  engineUsage: Annotation<Record<string, number>>({
    reducer: (prev, next) => next ?? prev,
    default: () => ({}),
  }),

  // 乐观派
  optimisticThinking: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  optimisticAnswer: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  optimisticRebuttal: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  // 悲观派
  pessimisticThinking: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  pessimisticAnswer: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  pessimisticRebuttal: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),

  // 辩论控制
  shouldContinue: Annotation<boolean>({
    reducer: (prev, next) => next ?? prev,
    default: () => false,
  }),
  round: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 0,
  }),
  maxRounds: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 2,
  }),

  // 辩论结果 - 使用具体类型
  debateWinner: Annotation<DebateWinner>({
    reducer: (prev, next) => next ?? prev,
    default: () => 'draw',
  }),
  debateSummary: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
});

export type GraphState = typeof GraphAnnotation.State;
