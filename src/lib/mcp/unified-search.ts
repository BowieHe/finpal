import { SearchResult, SearchResultItem, PLACEHOLDER_RESULT } from '../../types/mcp';
import { mcpManager } from './manager';
import { createLogger } from '../logger';

const logger = createLogger('MCPSearch');

/**
 * MCP 搜索 - 使用 bailian-websearch MCP 服务器
 */
export const smartSearch = async (
  query: string,
  options?: {
    useLLM?: boolean;
    maxRetries?: number;
    count?: number;
  }
): Promise<SearchResult> => {
  const startTime = Date.now();
  const maxRetries = options?.maxRetries ?? 1; // 默认重试 1 次
  const count = options?.count ?? 10; // 默认每次返回 10 条
  let attempts = 0;

  logger.info('Starting MCP search', { query, count });

  while (attempts <= maxRetries) {
    try {
      attempts++;
      // 获取 MCP 客户端
      const client = await mcpManager.getClient('bailian-websearch');

      // 调用 MCP 工具进行搜索
      const results = await logger.timed(
        'MCP Web Search',
        async () => {
          const response = await client.callTool({
            name: 'bailian_web_search',
            arguments: { query, count },
          });

          // 解析 MCP 返回的结果
          const content = response.content as Array<{ type: string; text: string }>;
          const textContent = content.find(c => c.type === 'text')?.text || '[]';

          try {
            const parsed = JSON.parse(textContent);
            let results;
            if (Array.isArray(parsed)) {
              results = parsed;
            } else if (parsed.pages && Array.isArray(parsed.pages)) {
              results = parsed.pages.map((p: any) => ({
                title: p.title || 'No title',
                description: p.snippet || p.content || '',
                url: p.url || '',
              }));
            } else {
              results = [];
            }
            return results;
          } catch (parseError) {
            return [{ title: 'Search Result', url: '', description: textContent }];
          }
        },
        { query, attempt: attempts }
      );

      const items: SearchResultItem[] = results.map((item: any, index: number) => ({
        title: item.title || 'No title',
        url: item.url || '',
        description: item.description || '',
        position: index + 1,
      }));

      return {
        query,
        engine: 'bailian-websearch',
        results: items,
        timestamp: Date.now(),
        reasoning: `MCP search completed (attempt ${attempts}), found ${items.length} results`,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTransient = errorMessage.includes('fetch failed') || errorMessage.includes('timeout');
      
      if (isTransient && attempts <= maxRetries) {
        logger.warn(`MCP search attempt ${attempts} failed, retrying...`, { error: errorMessage, query });
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // 指数退避
        continue;
      }

      logger.error('MCP search failed final', { error: errorMessage, query, attempts });

      return {
        ...PLACEHOLDER_RESULT,
        query,
        engine: 'error',
        reasoning: `搜索失败: ${errorMessage} (尝试了 ${attempts} 次)`,
        error: true,
        duration: Date.now() - startTime,
      };
    }
  }

  return { ...PLACEHOLDER_RESULT, query }; // Should not reach here
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
