/**
 * Skill 层类型定义
 * 
 * 定义 Skill 的接口和元数据类型
 */

import { SkillInput, SkillOutput } from '../core/types';
import { SearchResult } from '@/types/mcp';

/**
 * Skill 元数据
 * 用于描述 Skill 的能力和触发条件
 */
export interface SkillMetadata {
  /** Skill 唯一名称 */
  name: string;
  
  /** 描述 */
  description: string;
  
  /** 版本 */
  version?: string;
  
  /** 触发关键词 */
  triggers?: string[];
  
  /** 需要的工具 */
  requiredTools?: string[];
  
  /** 输出 Schema 名称 */
  outputSchema?: string;
}

/**
 * Skill 接口
 * 所有 Skill 必须实现此接口
 */
export interface ISkill {
  /** Skill 元数据 */
  readonly metadata: SkillMetadata;

  /** 执行 Skill */
  execute(input: SkillInput, onProgress?: (event: any) => void): Promise<SkillOutput>;
}

/**
 * Fund Deep Search Skill 特定输入
 */
export interface FundDeepSearchInput extends SkillInput {
  /** 搜索焦点 */
  focus?: ('financial' | 'news' | 'manager' | 'risk' | 'competitor' | 'macro' | 'technical')[];

  /** 搜索深度 */
  depth?: 'shallow' | 'normal' | 'deep';

  /** 之前发现的缺口，用于补充搜索 */
  previousGaps?: string[];

  /** 是否是重试（基于缺口优化） */
  isRetry?: boolean;
}

/**
 * Fund Deep Search Skill 输出数据结构
 */
export interface FundDeepSearchData {
  /** 数据置信度 */
  confidence?: number;

  /** 信息缺口 */
  gaps?: string[];

  /** 研究白板 */
  researchBoard?: {
    proposal: {
      mainQuestion: string;
      subQuestions: string[];
      priorityOrder: string[];
    };
    knownFacts: Array<{
      claim: string;
      source: string;
      confidence: number;
      gapCovered?: string;
    }>;
    informationGaps: string[];
    hypotheses: Array<{
      gap: string;
      rationale: string;
      targetSources: string[];
      queryPatterns: string[];
    }>;
    searchedQueries: string[];
    failedPaths: Array<{
      query: string;
      reason: string;
    }>;
    stopReason?: string;
  };

  fundInfo: {
    name: string;
    code?: string;
    type?: string;
    nav?: number;
    aum?: number;
    manager?: string;
    company?: string;
  };

  financials?: {
    latestReport?: string;
    revenue?: number;
    profit?: number;
    expenseRatio?: number;
  };

  news: Array<{
    title: string;
    date?: string;
    source?: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    summary?: string;
  }>;

  risks: string[];

  competitors?: string[];

  sources: string[];

  searchResults?: SearchResult[];
  searchQueries: string[];
}

/**
 * Fund Debate Skill 特定输入
 */
export interface FundDebateInput extends SkillInput {
  /** 来自 DeepSearch 的研究数据 */
  researchData: FundDeepSearchData;
}

/**
 * Fund Debate Skill 输出数据结构
 */
export interface FundDebateData {
  bullCase: {
    thesis: string;
    catalysts: string[];
    targetPrice?: number;
    confidence: number;
  };
  
  bearCase: {
    thesis: string;
    risks: string[];
    downsidePrice?: number;
    confidence: number;
  };
  
  synthesis: {
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell' | 'info_only';
    conviction: number;
    keyFactors: string[];
    timeHorizon: string;
    summary: string;
  };
  
  evCalculation?: {
    upsideScenario: { probability: number; return: number };
    baseScenario: { probability: number; return: number };
    downsideScenario: { probability: number; return: number };
    expectedReturn: number;
  };

  rounds?: Array<{
    round: number;
    optimistic: string;
    pessimistic: string;
    judge: {
      winner: 'optimistic' | 'pessimistic' | 'draw';
      shouldContinue: boolean;
      reason: string;
    };
  }>;
}
