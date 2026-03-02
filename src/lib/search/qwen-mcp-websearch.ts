/**
 * Qwen WebSearch MCP 客户端
 * 使用阿里云官方 MCP WebSearch 服务
 * 文档：https://bailian.console.aliyun.com/cn-beijing/?tab=app#/mcp-market/detail/WebSearch
 * HTTP 端点：https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp
 */

import { createLogger } from '../logger';

const logger = createLogger('QwenMCPWebSearch');

const MCP_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch';

// 获取 API Key
const getApiKey = (): string => process.env.DASHSCOPE_API_KEY || '';

/**
 * MCP WebSearch 请求参数
 */
interface MCPWebSearchRequest {
  query: string;
  top_n?: number;        // 返回结果数量，默认 10
  recency_days?: number; // 时间过滤（天），默认 30
  site?: string;         // 限定站点
}

/**
 * MCP WebSearch 搜索结果项
 */
interface MCPWebSearchResultItem {
  title: string;
  link: string;
  snippet: string;       // 摘要
  content?: string;      // 全文（部分结果包含）
  site_name?: string;    // 站点名称
  icon?: string;         // 站点图标
  publish_date?: string; // 发布日期
}

/**
 * MCP WebSearch 响应
 */
interface MCPWebSearchResponse {
  results: MCPWebSearchResultItem[];
  total: number;
  query: string;
  search_time?: number;  // 搜索耗时（毫秒）
}

/**
 * 标准搜索结果格式（兼容现有代码）
 */
export interface WebSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    description: string;
    content?: string;
    source?: string;
    publishDate?: string;
  }>;
  total: number;
  duration: number;
  timestamp: number;
}

/**
 * 单个查询搜索
 * @param query 搜索查询
 * @param options 搜索选项
 */
export async function mcpWebSearch(
  query: string,
  options: {
    topN?: number;
    recencyDays?: number;
    site?: string;
  } = {}
): Promise<WebSearchResult> {
  const startTime = Date.now();

  if (!getApiKey()) {
    logger.error('DASHSCOPE_API_KEY not configured');
    throw new Error('DASHSCOPE_API_KEY not configured');
  }

  logger.info('Starting MCP WebSearch', { query, options });

  try {
    const requestBody: MCPWebSearchRequest = {
      query,
      top_n: options.topN ?? 10,
      recency_days: options.recencyDays ?? 30,
      ...(options.site && { site: options.site }),
    };

    const response = await fetch(`${MCP_BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('MCP WebSearch API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`MCP WebSearch failed: ${response.status} - ${errorText}`);
    }

    const data: MCPWebSearchResponse = await response.json();
    const duration = Date.now() - startTime;

    logger.info('MCP WebSearch completed', {
      duration,
      resultCount: data.results?.length || 0,
      total: data.total,
    });

    // 转换为标准格式
    return {
      query: data.query || query,
      results: (data.results || []).map((item, index) => ({
        title: item.title || '无标题',
        url: item.link || '',
        description: item.snippet || '',
        content: item.content,
        source: item.site_name,
        publishDate: item.publish_date,
      })),
      total: data.total || 0,
      duration,
      timestamp: Date.now(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('MCP WebSearch failed', { error: errorMessage, duration });
    
    // 返回空结果而不是抛出，便于降级处理
    return {
      query,
      results: [],
      total: 0,
      duration,
      timestamp: Date.now(),
    };
  }
}

/**
 * 并行搜索多个查询
 * @param queries 查询列表
 * @param options 搜索选项
 */
export async function parallelMCPWebSearch(
  queries: string[],
  options?: {
    topN?: number;
    recencyDays?: number;
  }
): Promise<WebSearchResult[]> {
  logger.info('Starting parallel MCP WebSearch', { queryCount: queries.length });

  const promises = queries.map(async (query, index) => {
    try {
      // 添加小延迟避免瞬时并发过高
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, index * 100));
      }
      
      const result = await mcpWebSearch(query, options);
      
      return {
        ...result,
        query, // 确保保留原始查询
      };
    } catch (error) {
      logger.error(`Parallel search failed for query "${query}"`, { error });
      // 返回空结果
      return {
        query,
        results: [],
        total: 0,
        duration: 0,
        timestamp: Date.now(),
      };
    }
  });

  const results = await Promise.all(promises);
  
  const totalResults = results.reduce((sum, r) => sum + r.results.length, 0);
  logger.info('Parallel MCP WebSearch completed', {
    queryCount: queries.length,
    totalResults,
  });

  return results;
}

/**
 * 带重试的搜索
 * @param query 搜索查询
 * @param options 搜索选项
 * @param maxRetries 最大重试次数
 */
export async function mcpWebSearchWithRetry(
  query: string,
  options?: {
    topN?: number;
    recencyDays?: number;
  },
  maxRetries: number = 2
): Promise<WebSearchResult> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retrying MCP WebSearch (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
      
      return await mcpWebSearch(query, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        logger.warn(`MCP WebSearch attempt ${attempt + 1} failed, will retry`, {
          error: lastError.message
        });
      }
    }
  }
  
  logger.error('MCP WebSearch failed after all retries', { error: lastError });
  
  // 返回空结果
  return {
    query,
    results: [],
    total: 0,
    duration: 0,
    timestamp: Date.now(),
  };
}
