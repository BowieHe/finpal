import { SearchResult, PLACEHOLDER_RESULT, QueryCategory } from '../../types/mcp';
import { aliyunWebSearch } from '../search/aliyun-websearch';
import { classifyQuery, quickClassify } from '../search/query-classifier';
import { createLogger } from '../logger';

const logger = createLogger('AliyunSearch');

// 阿里云搜索是否可用
const isAliyunAvailable = (): boolean => {
  return !!process.env.DASHSCOPE_API_KEY;
};

/**
 * 阿里云搜索 - 固定使用阿里云 Web Search
 */
export const smartSearch = async (
  query: string,
  options?: {
    useLLM?: boolean;
    category?: QueryCategory;
  }
): Promise<SearchResult> => {
  const startTime = Date.now();

  logger.info('Starting Aliyun search', { query, options });

  // 确定查询类别（用于日志和统计）
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

  // 检查阿里云是否可用
  if (!isAliyunAvailable()) {
    logger.error('DASHSCOPE_API_KEY not configured');
    return {
      ...PLACEHOLDER_RESULT,
      query,
      engine: 'aliyun-websearch',
      reasoning: 'DASHSCOPE_API_KEY 未配置，无法使用阿里云搜索',
      category,
      error: true,
    };
  }

  // 执行阿里云搜索
  try {
    logger.info('Using Aliyun Web Search', { query });
    const result = await logger.timed(
      'Aliyun Web Search',
      () => aliyunWebSearch(query),
      { query }
    );

    const duration = Date.now() - startTime;
    logger.info('Aliyun search completed', {
      query,
      resultCount: result.results.length,
      duration,
    });

    return {
      ...result,
      reasoning: `[${category}] ${classificationReasoning}. ${result.reasoning}`,
      category,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Aliyun search failed', { error: errorMessage, query });
    
    return {
      ...PLACEHOLDER_RESULT,
      query,
      engine: 'aliyun-websearch',
      reasoning: `[${category}] ${classificationReasoning}. 搜索失败: ${errorMessage}`,
      category,
      error: true,
      duration: Date.now() - startTime,
    };
  }

  const duration = Date.now() - startTime;
  logger.info('Aliyun search completed', {
    query,
    resultCount: result.results.length,
    duration,
  });

  return {
    ...result,
    reasoning: `[${category}] ${classificationReasoning}. ${result.reasoning}`,
    category,
    duration,
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
