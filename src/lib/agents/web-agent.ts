/**
 * Web-Agent — 联网信息侦察专员
 *
 * 职责：唯一负责所有外部信息获取（基金经理动态、市场新闻、最新行情等）。
 * 约束：不访问数据库，不调用 LLM 分析，只返回搜索结果的结构化摘要。
 */

import { WebAgentInput, WebAgentOutput } from './types';
import { smartSearch } from '../mcp/unified-search';
import { mcpManager } from '../mcp/manager';
import { createLogger } from '../logger';

const logger = createLogger('WebAgent');

// 各 task 类型对应的搜索 query 模板
const QUERY_TEMPLATES: Record<string, (params: WebAgentInput['params']) => string> = {
  fund_info: ({ query, fundCode }) =>
    fundCode
      ? `${fundCode} ${query || '基金最新信息 净值 规模'}`
      : query || '',
  market_news: ({ query }) => query || '',
  manager_info: ({ query, fundCode }) =>
    fundCode
      ? `${fundCode} 基金经理 ${query || '管理变动 业绩'}`
      : query || '',
  fetch_page: ({ url }) => url || '',
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
    
    if (task === 'fetch_page') {
      const url = params.url;
      if (!url) throw new Error('fetch_page task requires a url parameter');
      
      logger.info('Web-Agent executing fetch_page', { url });
      input.onProgress?.(`准备深读网页内容: "${url}"`);

      const client = await mcpManager.getClient('playwright');
      const response = await client.callTool({
        name: 'playwright_navigate',
        arguments: { url }
      });
      
      input.onProgress?.(`网页加载完成，正在提取正文...`);
      const contentResponse = await client.callTool({
        name: 'playwright_get_content',
        arguments: {}
      });

      const fullText = (contentResponse.content as any)[0]?.text || '';
      const durationMs = Date.now() - startTime;
      
      return {
        agentId: 'web-agent',
        task,
        fundCode: params.fundCode,
        status: 'success',
        sources: [url],
        summary: fullText.substring(0, 500) + '...',
        query: url, // 网页深读直接用 URL 作为标识
        rawSnippets: [{
          title: '网页全文提取',
          url,
          content: fullText.substring(0, 3000) // 限制长度
        }],
        durationMs,
      };
    }

    logger.info('Web-Agent executing search', { task, query });
    input.onProgress?.(`准备通过通义 MCP 搜索网络: "${query}"`);

    const searchResult = await smartSearch(query);
    input.onProgress?.(`MCP 搜索完成，返回 ${searchResult.results?.length || 0} 条结果，正在过滤摘要...`);

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
        query, // 即使失败也返回 query
        rawSnippets: [],
        error: searchResult.reasoning,
        durationMs,
      };
    }

    // 提取信息来源 URL
    const sources = searchResult.results
      .map(r => r.url)
      .filter((url): url is string => !!url && url.length > 0);

    // 提取原始片段（取前 8 条，结构化保留来源）
    const rawSnippets = searchResult.results
      .slice(0, 8)
      .map(r => ({
        title: r.title || '无标题',
        url: r.url || '',
        content: (r.description ?? '').substring(0, 300)
      }))
      .filter(s => s.content.trim().length > 0);

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
      query, // 返回实际使用的 query
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
