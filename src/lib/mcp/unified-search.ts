import { SearchResult, SearchResultItem, PLACEHOLDER_RESULT } from '../../types/mcp';
import { mcpManager } from './manager';
import { createLogger } from '../logger';

const logger = createLogger('MCPSearch');

/**
 * MCP 搜索 - 使用 open-websearch MCP 服务器
 */
export const smartSearch = async (
  query: string,
  options?: {
    useLLM?: boolean;
  }
): Promise<SearchResult> => {
  const startTime = Date.now();

  logger.info('Starting MCP search', { query });

  try {
    // 获取 MCP 客户端
    const client = await mcpManager.getClient('open-websearch');

    // 调用 MCP 工具进行搜索
    const result = await logger.timed(
      'MCP Web Search',
      async () => {
        const response = await client.callTool({
          name: 'web_search',
          arguments: { query },
        });

        // 解析 MCP 返回的结果
        const content = response.content as Array<{ type: string; text: string }>;
        const textContent = content.find(c => c.type === 'text')?.text || '[]';
        
        try {
          return JSON.parse(textContent);
        } catch {
          // 如果不是 JSON，按文本处理
          return [{
            title: 'Search Result',
            url: '',
            description: textContent,
          }];
        }
      },
      { query }
    );

    // 转换结果为 SearchResult 格式
    const items: SearchResultItem[] = Array.isArray(result) 
      ? result.map((item: any, index: number) => ({
          title: item.title || 'No title',
          url: item.url || item.link || '',
          description: item.snippet || item.description || item.content || '',
          position: index + 1,
        }))
      : [];

    const duration = Date.now() - startTime;
    logger.info('MCP search completed', {
      query,
      resultCount: items.length,
      duration,
    });

    return {
      query,
      engine: 'open-websearch',
      results: items,
      timestamp: Date.now(),
      reasoning: `MCP search completed, found ${items.length} results`,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('MCP search failed', { error: errorMessage, query });

    return {
      ...PLACEHOLDER_RESULT,
      query,
      engine: 'error',
      reasoning: `搜索失败: ${errorMessage}`,
      error: true,
      duration: Date.now() - startTime,
    };
  }
};

/**
 * 统一搜索接口 - 兼容旧版调用
 */
export const unifiedSearch = async (
  query: string
): Promise<SearchResult> => {
  return smartSearch(query);
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
    totalResults: 0,
    errors: 0,
  };

  for (const result of results) {
    stats.byEngine[result.engine] = (stats.byEngine[result.engine] || 0) + 1;
    stats.totalResults += result.results.length;
    if (result.error) {
      stats.errors++;
    }
  }

  return stats;
};
