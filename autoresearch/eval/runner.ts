/**
 * 批量测试运行器
 * 
 * 运行测试套件并收集评估指标
 */

import { chatGraph } from '@/lib/graph/graph';
import { evaluateSearchQuality, evaluateFinalReport, EvaluationResult, SearchQualityResult } from './judge';
import { TestCase, testCases } from './data/test-cases';
import { QueryConfig } from '../search/config/query-config';
import { FilterConfig } from '../search/config/filter-config';
import { createLogger } from '@/lib/logger';
import { SearchResult } from '@/types/mcp';

const logger = createLogger('Runner');

/**
 * 单个测试结果
 */
export interface SingleTestResult {
  testCase: TestCase;
  durationMs: number;
  searchResults: SearchResult[];
  finalReport: string;
  searchEvaluation: SearchQualityResult;
  reportEvaluation: EvaluationResult;
  tokenUsage: {
    searchTokens: number;
    analysisTokens: number;
    total: number;
  };
  error?: string;
}

/**
 * 完整运行结果
 */
export interface RunResult {
  experimentId: string;
  timestamp: number;
  config: {
    queryConfig: QueryConfig;
    filterConfig: FilterConfig;
  };
  results: SingleTestResult[];
  aggregateMetrics: {
    totalTests: number;
    successCount: number;
    failureCount: number;
    avgQualityScore: number;
    avgRelevanceScore: number;
    avgCompletenessScore: number;
    avgClarityScore: number;
    avgActionabilityScore: number;
    avgSearchRelevance: number;
    avgDurationMs: number;
    totalTokenUsage: number;
  };
}

/**
 * 运行单个测试用例
 */
async function runSingleTest(
  testCase: TestCase,
  queryConfig: QueryConfig,
  filterConfig: FilterConfig
): Promise<SingleTestResult> {
  const startTime = Date.now();
  
  try {
    logger.info(`运行测试用例: ${testCase.id}`, { question: testCase.question });
    
    // 准备图状态
    const initialState = {
      question: testCase.question,
      messages: [],
      searchResults: [],
      researchSummary: '',
      plan: null,
      agentOutputs: {},
      dataSynthesis: '',
      optimisticThinking: '',
      optimisticAnswer: '',
      pessimisticThinking: '',
      pessimisticAnswer: '',
      roundJudgeReasoning: '',
      roundWinner: null,
      shouldContinue: false,
      round: 0,
      maxRounds: 3,
      finalVerdict: null,
      progressCallback: undefined,
    };
    
    // 运行图（非流式，等待完整结果）
    const result = await chatGraph.invoke(initialState);
    
    const durationMs = Date.now() - startTime;
    
    // 提取搜索结果
    const searchResults: SearchResult[] = result.searchResults || [];
    
    // 生成最终报告
    const finalReport = result.finalVerdict 
      ? formatFinalReport(result.finalVerdict)
      : '未生成最终报告';
    
    // 评估搜索质量（取第一个搜索结果进行评估）
    const searchEvaluation = searchResults.length > 0
      ? await evaluateSearchQuality(testCase.question, searchResults[0])
      : {
          searchRelevance: 0,
          coverageScore: 0,
          diversityScore: 0,
          freshnessScore: 0,
          reasoning: '无搜索结果',
        };
    
    // 评估最终报告质量
    const reportEvaluation = await evaluateFinalReport(
      testCase.question,
      searchResults[0] || { query: '', engine: 'none', results: [] },
      finalReport,
      {
        optimisticView: result.optimisticAnswer,
        pessimisticView: result.pessimisticAnswer,
        rounds: result.round,
      }
    );
    
    // 估算 token 使用量
    const tokenUsage = estimateTokenUsage(result);
    
    logger.info(`测试完成: ${testCase.id}`, { 
      durationMs, 
      qualityScore: reportEvaluation.qualityScore 
    });
    
    return {
      testCase,
      durationMs,
      searchResults,
      finalReport,
      searchEvaluation,
      reportEvaluation,
      tokenUsage,
    };
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error(`测试失败: ${testCase.id}`, { error });
    
    return {
      testCase,
      durationMs,
      searchResults: [],
      finalReport: '',
      searchEvaluation: {
        searchRelevance: 0,
        coverageScore: 0,
        diversityScore: 0,
        freshnessScore: 0,
        reasoning: '测试执行失败',
      },
      reportEvaluation: {
        qualityScore: 0,
        relevanceScore: 0,
        completenessScore: 0,
        clarityScore: 0,
        actionabilityScore: 0,
        reasoning: `测试执行失败: ${error instanceof Error ? error.message : String(error)}`,
      },
      tokenUsage: { searchTokens: 0, analysisTokens: 0, total: 0 },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 格式化最终报告
 */
function formatFinalReport(verdict: any): string {
  if (!verdict) return '未生成报告';
  
  return `
投资建议：${verdict.recommendation || '未知'}
置信度：${verdict.confidence || '未知'}

核心观点：
${verdict.summary || verdict.reasoning || '无'}

做多理由：
${(verdict.bullPoints || []).map((p: string) => `- ${p}`).join('\n')}

做空理由：
${(verdict.bearPoints || []).map((p: string) => `- ${p}`).join('\n')}

操作建议：
${verdict.action || verdict.nextSteps || '无具体建议'}
`.trim();
}

/**
 * 估算 token 使用量
 */
function estimateTokenUsage(result: any): { searchTokens: number; analysisTokens: number; total: number } {
  // 简单估算：1 token ≈ 4 字符（中文）
  const searchText = JSON.stringify(result.searchResults || []);
  const analysisText = [
    result.researchSummary,
    result.optimisticAnswer,
    result.pessimisticAnswer,
    result.finalVerdict?.summary,
  ].join(' ');
  
  const searchTokens = Math.ceil(searchText.length / 4);
  const analysisTokens = Math.ceil(analysisText.length / 4);
  
  return {
    searchTokens,
    analysisTokens,
    total: searchTokens + analysisTokens,
  };
}

/**
 * 计算聚合指标
 */
function calculateAggregateMetrics(results: SingleTestResult[]) {
  const validResults = results.filter(r => !r.error);
  
  if (validResults.length === 0) {
    return {
      totalTests: results.length,
      successCount: 0,
      failureCount: results.length,
      avgQualityScore: 0,
      avgRelevanceScore: 0,
      avgCompletenessScore: 0,
      avgClarityScore: 0,
      avgActionabilityScore: 0,
      avgSearchRelevance: 0,
      avgDurationMs: 0,
      totalTokenUsage: 0,
    };
  }
  
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  
  return {
    totalTests: results.length,
    successCount: validResults.length,
    failureCount: results.length - validResults.length,
    avgQualityScore: avg(validResults.map(r => r.reportEvaluation.qualityScore)),
    avgRelevanceScore: avg(validResults.map(r => r.reportEvaluation.relevanceScore)),
    avgCompletenessScore: avg(validResults.map(r => r.reportEvaluation.completenessScore)),
    avgClarityScore: avg(validResults.map(r => r.reportEvaluation.clarityScore)),
    avgActionabilityScore: avg(validResults.map(r => r.reportEvaluation.actionabilityScore)),
    avgSearchRelevance: avg(validResults.map(r => r.searchEvaluation.searchRelevance)),
    avgDurationMs: avg(validResults.map(r => r.durationMs)),
    totalTokenUsage: validResults.reduce((sum, r) => sum + r.tokenUsage.total, 0),
  };
}

/**
 * 运行完整测试套件
 */
export async function runTestSuite(
  experimentId: string,
  queryConfig: QueryConfig,
  filterConfig: FilterConfig,
  options?: {
    testCases?: TestCase[];      // 指定测试用例子集
    maxConcurrency?: number;     // 最大并发数（默认 1，串行）
    onProgress?: (completed: number, total: number, current: TestCase) => void;
  }
): Promise<RunResult> {
  const cases = options?.testCases || testCases;
  const results: SingleTestResult[] = [];
  
  logger.info(`开始运行测试套件: ${experimentId}`, { 
    totalTests: cases.length,
    config: queryConfig.version 
  });
  
  // 串行运行（避免 rate limit 和并发问题）
  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    
    if (options?.onProgress) {
      options.onProgress(i, cases.length, testCase);
    }
    
    const result = await runSingleTest(testCase, queryConfig, filterConfig);
    results.push(result);
    
    // 添加延迟避免 rate limit
    if (i < cases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const aggregateMetrics = calculateAggregateMetrics(results);
  
  logger.info(`测试套件完成: ${experimentId}`, {
    totalTests: aggregateMetrics.totalTests,
    successCount: aggregateMetrics.successCount,
    avgQualityScore: aggregateMetrics.avgQualityScore.toFixed(2),
  });
  
  return {
    experimentId,
    timestamp: Date.now(),
    config: { queryConfig, filterConfig },
    results,
    aggregateMetrics,
  };
}

/**
 * 快速运行单个测试（用于调试）
 */
export async function runSingleTestQuick(
  testId: string,
  queryConfig?: QueryConfig,
  filterConfig?: FilterConfig
): Promise<SingleTestResult | null> {
  const testCase = testCases.find(tc => tc.id === testId);
  if (!testCase) {
    logger.error(`未找到测试用例: ${testId}`);
    return null;
  }
  
  // 使用默认配置
  const defaultQueryConfig = queryConfig || {
    version: 'default',
    fundAnalysis: { queryCount: 2, template: '{fundCode} {aspect}', aspects: ['最新净值', '基金经理'] },
    portfolioReview: { queryCount: 3, includeSectorNews: false, includeMarketOverview: true, includeIndividualFund: false },
    marketNews: { queryCount: 2, recencyWeight: 0.5 },
    general: { maxQueryLength: 100, language: 'zh' },
  };
  
  const defaultFilterConfig = filterConfig || {
    version: 'default',
    limits: { maxResults: 8, minResults: 3, maxPerDomain: 3 },
    deduplication: { enabled: false, similarityThreshold: 0.8, preferRecent: true },
    ranking: { strategy: 'relevance', recencyWeight: 0.3, relevanceWeight: 0.7, diversityWeight: 0 },
    filtering: { minDescriptionLength: 10, maxDescriptionLength: 300 },
    summarization: { maxSummaryLength: 500, includeTitles: true, maxTitlesInSummary: 5 },
  };
  
  return runSingleTest(testCase, defaultQueryConfig, defaultFilterConfig);
}

export { testCases };
export type { TestCase };
