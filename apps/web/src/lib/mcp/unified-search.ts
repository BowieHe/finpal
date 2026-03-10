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
  }
): Promise<SearchResult> => {
  const startTime = Date.now();

  logger.info('Starting MCP search', { query });

  try {
    // 获取 MCP 客户端
    const client = await mcpManager.getClient('bailian-websearch');

    // 调用 MCP 工具进行搜索
    const result = await logger.timed(
      'MCP Web Search',
      async () => {
        const response = await client.callTool({
          name: 'bailian_web_search',
          arguments: { query },
        });

        // 解析 MCP 返回的结果
        const content = response.content as Array<{ type: string; text: string }>;
        
        logger.info('MCP response content', {
          query,
          contentItems: content?.length || 0,
          contentTypes: content?.map(c => c.type),
        });

        const textContent = content.find(c => c.type === 'text')?.text || '[]';
        
        // 临时打印完整的 textContent 用于调试
        logger.info('MCP text content FULL', {
          query,
          textContentLength: textContent?.length || 0,
          fullTextContent: textContent,
        });
        
        try {
          const parsed = JSON.parse(textContent);
          
          // 处理两种格式:
          // 1. 数组格式: [{title, description, url}]
          // 2. 对象格式: {pages: [{snippet, title, url}]}
          let results;
          if (Array.isArray(parsed)) {
            results = parsed;
          } else if (parsed.pages && Array.isArray(parsed.pages)) {
            // 阿里云百炼格式
            results = parsed.pages.map((p: any) => ({
              title: p.title || 'No title',
              description: p.snippet || p.content || '',
              url: p.url || '',
            }));
          } else {
            results = [];
          }
          
          logger.info('MCP parsed result', {
            query,
            resultType: typeof parsed,
            isArray: Array.isArray(parsed),
            hasPages: !!parsed.pages,
            resultsCount: results.length,
            firstItem: results.length > 0 
              ? JSON.stringify(results[0]).substring(0, 200)
              : null,
          });
          return results;
        } catch (parseError) {
          logger.error('MCP JSON parse error', { 
            query, 
            error: String(parseError),
            textContent: textContent?.substring(0, 200),
          });
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

    // result 已经是转换后的格式
    const items: SearchResultItem[] = Array.isArray(result) 
      ? result.map((item: any, index: number) => ({
          title: item.title || 'No title',
          url: item.url || '',
          description: item.description || '',
          position: index + 1,
        }))
      : [];

    const duration = Date.now() - startTime;
    logger.info('MCP search completed', {
      query,
      resultCount: items.length,
      duration,
      sampleResults: items.slice(0, 2).map(i => ({
        title: i.title?.substring(0, 50),
        url: i.url?.substring(0, 50),
      })),
    });

    return {
      query,
      engine: 'bailian-websearch',
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
