import { search, SearchResults } from 'duck-duck-scrape';
import { SearchResult } from '@/types/mcp';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DuckDuckGo');

// 配置
const MIN_DELAY_MS = 2000; // 最小延迟 2 秒
const MAX_DELAY_MS = 5000; // 最大延迟 5 秒
const MAX_RETRIES = 3; // 最大重试次数

/**
 * 随机延迟，避免请求模式规律化
 */
function randomDelay(): Promise<void> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 指数退避延迟
 */
function exponentialBackoffDelay(attempt: number): Promise<void> {
  const baseDelay = 2000;
  const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 使用 DuckDuckGo 进行搜索（带重试）
 * @param query 搜索查询
 * @returns 标准化的搜索结果
 */
export const duckDuckGoSearch = async (
  query: string,
  retryCount = 0
): Promise<SearchResult> => {
  const startTime = Date.now();

  try {
    logger.info(`Searching for: "${query}" (attempt ${retryCount + 1}/${MAX_RETRIES})`);

    const searchResults: SearchResults = await search(query, {
      safeSearch: 0, // 0 = off, 1 = moderate, 2 = strict
    });

    const duration = Date.now() - startTime;

    // 转换 DuckDuckGo 结果为统一格式
    const results = searchResults.results.map((result, index) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      position: index + 1,
    }));

    logger.info(`Found ${results.length} results in ${duration}ms`);

    return {
      query,
      engine: 'duckduckgo',
      results,
      timestamp: Date.now(),
      reasoning: `DuckDuckGo 搜索完成，找到 ${results.length} 条结果，耗时 ${duration}ms`,
      duration,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 检测是否是速率限制错误
    const isRateLimitError =
      errorMessage.includes('too quickly') ||
      errorMessage.includes('anomaly') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429');

    if (isRateLimitError && retryCount < MAX_RETRIES - 1) {
      logger.warn(`Rate limited, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
      await exponentialBackoffDelay(retryCount);
      return duckDuckGoSearch(query, retryCount + 1);
    }

    logger.error(`Search failed after ${retryCount + 1} attempts`, { error: errorMessage });

    return {
      query,
      engine: 'duckduckgo',
      results: [],
      timestamp: Date.now(),
      reasoning: `DuckDuckGo 搜索失败: ${errorMessage}`,
      duration: Date.now() - startTime,
      error: true,
    };
  }
};

/**
 * 批量搜索多个查询
 * @param queries 搜索查询数组
 * @returns 搜索结果数组
 */
export const duckDuckGoBatchSearch = async (
  queries: string[]
): Promise<SearchResult[]> => {
  logger.info(`Starting batch search for ${queries.length} queries`);

  // 串行执行以避免速率限制
  const results: SearchResult[] = [];
  for (const query of queries) {
    const result = await duckDuckGoSearch(query);
    results.push(result);
    // 添加随机延迟以避免触发速率限制
    if (queries.indexOf(query) < queries.length - 1) {
      await randomDelay();
    }
  }

  logger.info(`Completed ${results.length} searches`);
  return results;
};
