import { search, SearchResults } from 'duck-duck-scrape';
import { SearchResult } from '@/types/mcp';

/**
 * 使用 DuckDuckGo 进行搜索
 * @param query 搜索查询
 * @returns 标准化的搜索结果
 */
export const duckDuckGoSearch = async (
  query: string
): Promise<SearchResult> => {
  const startTime = Date.now();
  
  try {
    console.log(`[DuckDuckGo Search] Searching for: "${query}"`);
    
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
    
    console.log(`[DuckDuckGo Search] Found ${results.length} results in ${duration}ms`);
    
    return {
      query,
      engine: 'duckduckgo',
      results,
      timestamp: Date.now(),
      reasoning: `DuckDuckGo 搜索完成，找到 ${results.length} 条结果，耗时 ${duration}ms`,
      duration,
    };
    
  } catch (error) {
    console.error(`[DuckDuckGo Search] Search failed:`, error);
    
    return {
      query,
      engine: 'duckduckgo',
      results: [],
      timestamp: Date.now(),
      reasoning: `DuckDuckGo 搜索失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  console.log(`[DuckDuckGo Batch] Starting batch search for ${queries.length} queries`);
  
  // 串行执行以避免速率限制
  const results: SearchResult[] = [];
  for (const query of queries) {
    const result = await duckDuckGoSearch(query);
    results.push(result);
    // 添加延迟以避免触发速率限制
    if (queries.indexOf(query) < queries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`[DuckDuckGo Batch] Completed ${results.length} searches`);
  return results;
};
