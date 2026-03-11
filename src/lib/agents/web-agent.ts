/**
 * Web-Agent — 联网信息侦察专员
 *
 * 职责：唯一负责所有外部信息获取（基金经理动态、市场新闻、最新行情等）。
 * 约束：不访问数据库，不调用 LLM 分析，只返回搜索结果的结构化摘要。
 */

import { WebAgentInput, WebAgentOutput } from './types';
import { smartSearch } from '../mcp/unified-search';
import { createLogger } from '../logger';

const logger = createLogger('WebAgent');

// 各 task 类型对应的搜索 query 模板
const QUERY_TEMPLATES: Record<string, (params: WebAgentInput['params']) => string> = {
  fund_info: ({ query, fundCode }) =>
    fundCode
      ? `${fundCode} ${query || '基金最新信息 净值 规模'}`
      : query,
  market_news: ({ query }) => query,
  manager_info: ({ query, fundCode }) =>
    fundCode
      ? `${fundCode} 基金经理 ${query || '管理变动 业绩'}`
      : query,
};

/**
 * Web-Agent 主函数
 *
 * 根据 task 类型生成搜索查询，调用 MCP 搜索工具，
 * 并将结果整理为标准化输出。
 */
export async function webAgent(input: WebAgentInput): Promise<WebAgentOutput> {
  const startTime = Date.now();
  const { task, params } = input;

  logger.info('Web-Agent started', { task, params });

  try {
    const queryBuilder = QUERY_TEMPLATES[task];
    if (!queryBuilder) {
      throw new Error(`Unknown Web-Agent task: ${task}`);
    }

    const query = queryBuilder(params);
    logger.info('Web-Agent executing search', { task, query });

    const searchResult = await smartSearch(query);

    if (searchResult.error || searchResult.results.length === 0) {
      const durationMs = Date.now() - startTime;
      logger.warn('Web-Agent search returned empty or error', { task, query, durationMs });
      return {
        agentId: 'web-agent',
        task,
        fundCode: params.fundCode,
        status: 'partial',
        sources: [],
        summary: `搜索 "${query}" 未返回结果`,
        rawSnippets: [],
        error: searchResult.reasoning,
        durationMs,
      };
    }

    // 提取信息来源 URL
    const sources = searchResult.results
      .map(r => r.url)
      .filter((url): url is string => !!url && url.length > 0);

    // 提取原始片段（取前 8 条，每条限 300 字符）
    const rawSnippets = searchResult.results
      .slice(0, 8)
      .map(r => `[${r.title}] ${r.description ?? ''}`.substring(0, 300))
      .filter(s => s.trim().length > 0);

    // 生成结构化摘要（汇总标题列表）
    const summary = searchResult.results
      .slice(0, 5)
      .map(r => r.title)
      .filter(Boolean)
      .join('；');

    const durationMs = Date.now() - startTime;
    logger.info('Web-Agent completed', {
      task,
      fundCode: params.fundCode,
      resultCount: searchResult.results.length,
      durationMs,
    });

    return {
      agentId: 'web-agent',
      task,
      fundCode: params.fundCode,
      status: 'success',
      sources,
      summary,
      rawSnippets,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Web-Agent failed', { task, error: errorMessage, durationMs });

    return {
      agentId: 'web-agent',
      task,
      fundCode: params.fundCode,
      status: 'error',
      sources: [],
      summary: '',
      rawSnippets: [],
      error: errorMessage,
      durationMs,
    };
  }
}
