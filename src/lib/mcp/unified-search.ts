import { mcpManager } from '../mcp/manager';
import { SearchResult, SearchResultItem, PLACEHOLDER_RESULT, QueryCategory } from '../../types/mcp';
import { duckDuckGoSearch } from '../search/duckduckgo';
import { aliyunWebSearch } from '../search/aliyun-websearch';
import { classifyQuery, quickClassify } from '../search/query-classifier';
import { createLogger } from '../logger';

const logger = createLogger('SmartSearch');

// 搜索策略类型
export type SearchStrategy = 'smart' | 'duckduckgo' | 'aliyun-websearch' | 'open-websearch';

// 默认搜索策略
const DEFAULT_SEARCH_STRATEGY: SearchStrategy =
  (process.env.DEFAULT_SEARCH_ENGINE as SearchStrategy) || 'smart';

// 阿里云搜索是否可用
const isAliyunAvailable = (): boolean => {
  return !!process.env.DASHSCOPE_API_KEY;
};

interface Tool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface ToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

/**
 * 使用 open-websearch MCP 进行搜索
 */
const openWebsearchMCP = async (query: string): Promise<SearchResult> => {
  const startTime = Date.now();

  try {
    const client = await mcpManager.getClient('open-websearch');

    const tools = await client.listTools() as { tools: Tool[] };
    const searchTool = tools.tools.find((t: Tool) =>
      t.name.toLowerCase().includes('search')
    );

    if (!searchTool) {
      console.error(`[Open-Websearch] Search tool not found in MCP`);
      return {
        ...PLACEHOLDER_RESULT,
        query,
        engine: 'open-websearch',
        reasoning: 'Open-Websearch MCP 未找到搜索工具',
        error: true,
      };
    }

    console.log(`[Open-Websearch] Searching for: "${query}"`);
    const searchResult = await client.callTool({
      name: searchTool.name,
      arguments: {
        query,
        max_results: 10,
      },
    }) as ToolResult;

    const duration = Date.now() - startTime;

    // 解析 MCP 返回的结果
    const results: SearchResultItem[] = [];
    for (const item of searchResult.content || []) {
      if (item.type === 'text' && item.text) {
        try {
          const parsed = JSON.parse(item.text);
          if (Array.isArray(parsed.results)) {
            results.push(...parsed.results.map((r: unknown, index: number) => ({
              title: String((r as { title?: string }).title || ''),
              url: String((r as { link?: string }).link || (r as { url?: string }).url || ''),
              description: String((r as { snippet?: string }).snippet || (r as { description?: string }).description || ''),
              position: index + 1,
            })));
          }
        } catch {
          // 如果不是 JSON，作为文本结果
          results.push({
            title: '搜索结果',
            url: '',
            description: item.text,
            position: 1,
          });
        }
      }
    }

    return {
      query,
      engine: 'open-websearch',
      results,
      timestamp: Date.now(),
      reasoning: `Open-Websearch 搜索完成，找到 ${results.length} 条结果，耗时 ${duration}ms`,
      duration,
    };

  } catch (error) {
    console.error(`[Open-Websearch] Search failed:`, error);

    return {
      ...PLACEHOLDER_RESULT,
      query,
      engine: 'open-websearch',
      reasoning: `Open-Websearch 搜索失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: true,
    };
  }
};

/**
 * 智能搜索 - 根据查询类型和搜索策略选择搜索方式
 */
export const smartSearch = async (
  query: string,
  options?: {
    useLLM?: boolean;
    category?: QueryCategory;
    strategy?: SearchStrategy;
  }
): Promise<SearchResult> => {
  const startTime = Date.now();
  const strategy = options?.strategy || DEFAULT_SEARCH_STRATEGY;

  logger.info('Starting search', { query, strategy, options });

  // 确定查询类别（用于日志和统计，不影响搜索策略）
  let category: QueryCategory;
  let classificationReasoning = '';

  if (options?.category) {
    category = options.category;
    classificationReasoning = '使用指定的类别';
  } else if (options?.useLLM !== false) {
    const classification = await logger.timed(
      'Query classification',
      () => classifyQuery(query),
      { query }
    );
    category = classification.category;
    classificationReasoning = classification.reasoning;
    logger.info('LLM classification result', {
      category,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    });
  } else {
    category = quickClassify(query);
    classificationReasoning = '基于关键词快速分类';
    logger.info('Quick classification result', { category });
  }

  // 根据策略选择搜索方式
  switch (strategy) {
    case 'aliyun-websearch':
      if (isAliyunAvailable()) {
        logger.info('Using Aliyun Web Search', { query });
        const result = await logger.timed(
          'Aliyun Web Search',
          () => aliyunWebSearch(query),
          { query }
        );
        return {
          ...result,
          reasoning: `[${category}] ${classificationReasoning}. ${result.reasoning}`,
          category,
        };
      } else {
        logger.warn('Aliyun Web Search not available (DASHSCOPE_API_KEY not set), falling back to smart search');
      }
      // 阿里云不可用时回退到 smart 策略
      break;

    case 'duckduckgo':
      logger.info('Using DuckDuckGo search', { query });
      const ddgResult = await logger.timed(
        'DuckDuckGo search',
        () => duckDuckGoSearch(query),
        { query }
      );
      return {
        ...ddgResult,
        reasoning: `[${category}] ${classificationReasoning}. DuckDuckGo: ${ddgResult.reasoning}`,
        category,
      };

    case 'open-websearch':
      logger.info('Using Open Websearch MCP', { query });
      const mcpResult = await openWebsearchMCP(query);
      if (!mcpResult.error && mcpResult.results.length > 0) {
        return {
          ...mcpResult,
          reasoning: `[${category}] ${classificationReasoning}. ${mcpResult.reasoning}`,
          category,
        };
      }
      // MCP 失败时回退到 DuckDuckGo
      logger.warn('Open Websearch MCP failed, falling back to DuckDuckGo');
      const fallbackResult = await duckDuckGoSearch(query);
      return {
        ...fallbackResult,
        reasoning: `[${category}] ${classificationReasoning}. DuckDuckGo (fallback): ${fallbackResult.reasoning}`,
        category,
      };

    case 'smart':
    default:
      // 智能策略：先尝试 MCP，失败后回退到 DuckDuckGo
      logger.info('Trying open-websearch MCP', { query });

      const webResult = await openWebsearchMCP(query);
      if (!webResult.error && webResult.results.length > 0) {
        const duration = Date.now() - startTime;
        logger.info('MCP search successful', {
          query,
          resultCount: webResult.results.length,
          duration,
        });
        return {
          ...webResult,
          reasoning: `[${category}] ${classificationReasoning}. ${webResult.reasoning}`,
          category,
        };
      }

      // MCP 失败，回退到 DuckDuckGo
      logger.warn('MCP failed or no results, falling back to DuckDuckGo', {
        query,
        mcpError: webResult.error,
        mcpResultCount: webResult.results.length,
      });

      const ddgFallbackResult = await logger.timed(
        'DuckDuckGo fallback search',
        () => duckDuckGoSearch(query),
        { query }
      );

      const duration = Date.now() - startTime;
      logger.info('DuckDuckGo fallback completed', {
        query,
        resultCount: ddgFallbackResult.results.length,
        duration,
      });

      return {
        ...ddgFallbackResult,
        reasoning: `[${category}] ${classificationReasoning}. DuckDuckGo: ${ddgFallbackResult.reasoning} (总耗时 ${duration}ms)`,
        category,
      };
  }

  // 默认回退到 DuckDuckGo
  const defaultResult = await duckDuckGoSearch(query);
  return {
    ...defaultResult,
    reasoning: `[${category}] ${classificationReasoning}. DuckDuckGo (default): ${defaultResult.reasoning}`,
    category,
  };
};

/**
 * 统一搜索接口 - 兼容旧版调用
 */
export const unifiedSearch = async (
  query: string
): Promise<SearchResult> => {
  return smartSearch(query, { useLLM: false });
};

/**
 * 批量搜索多个查询
 */
export const batchSearch = async (
  queries: string[]
): Promise<SearchResult[]> => {
  logger.info('Starting batch search', { queryCount: queries.length, queries });

  const results: SearchResult[] = [];
  for (const query of queries) {
    const result = await smartSearch(query);
    results.push(result);
    // 添加延迟以避免触发速率限制
    if (queries.indexOf(query) < queries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  const stats = getSearchStats(results);
  logger.info('Batch search completed', { stats });
  return results;
};

/**
 * 获取搜索统计信息
 */
export const getSearchStats = (results: SearchResult[]) => {
  const stats = {
    total: results.length,
    byEngine: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    totalResults: 0,
    errors: 0,
  };

  for (const result of results) {
    stats.byEngine[result.engine] = (stats.byEngine[result.engine] || 0) + 1;
    if (result.category) {
      stats.byCategory[result.category] = (stats.byCategory[result.category] || 0) + 1;
    }
    stats.totalResults += result.results.length;
    if (result.error) {
      stats.errors++;
    }
  }

  return stats;
};
