import { SearchEngine, QueryCategory, QueryClassification } from '../../types/mcp';
import { classifyQuery, quickClassify, shouldUseSpecializedSource } from '../search/query-classifier';

export interface SearchRoute {
  engine: SearchEngine;
  category: QueryCategory;
  reasoning: string;
  usePlaywright: boolean;
}

/**
 * 根据查询选择搜索策略
 */
export async function chooseSearchEngine(
  query: string,
  options?: { useLLM?: boolean }
): Promise<SearchRoute> {
  // 使用 LLM 或快速规则进行分类
  let classification: QueryClassification;

  if (options?.useLLM !== false) {
    classification = await classifyQuery(query);
  } else {
    const category = quickClassify(query);
    classification = {
      category,
      confidence: 0.7,
      reasoning: '基于关键词快速分类',
    };
  }

  const { category, confidence, reasoning } = classification;

  // 根据类别选择搜索引擎
  if (category === 'general') {
    // 一般性问题：使用 open-websearch MCP
    return {
      engine: 'open-websearch',
      category,
      reasoning: `${reasoning} (置信度: ${confidence})`,
      usePlaywright: false,
    };
  }

  // 专业问题：使用 Playwright + open-websearch 组合
  return {
    engine: 'playwright',
    category,
    reasoning: `${reasoning} (置信度: ${confidence})，需要从专业网站提取信息`,
    usePlaywright: true,
  };
}

/**
 * 获取类别对应的数据源说明
 */
export function getCategoryDataSources(category: QueryCategory): string[] {
  const sources: Record<QueryCategory, string[]> = {
    general: ['Open-Websearch MCP', 'DuckDuckGo'],
    finance_news: ['路透社', '彭博社', '华尔街见闻', '财新网', '第一财经'],
    finance_data: ['东方财富网', '雪球', '同花顺', 'Google Finance'],
    encyclopedia: ['维基百科', '百度百科', 'Wikidata'],
    academic: ['Google Scholar', 'arXiv', '中国知网'],
    government: ['World Bank', 'IMF', '中国证监会', '国家统计局'],
    community: ['知乎', 'Quora', 'Reddit'],
  };

  return sources[category] || sources.general;
}

/**
 * 获取搜索建议
 */
export function getSearchSuggestion(query: string, category: QueryCategory): string {
  const suggestions: Record<QueryCategory, string> = {
    general: '正在使用通用搜索引擎查找相关信息...',
    finance_news: '正在从权威财经媒体获取最新资讯...',
    finance_data: '正在从专业财经平台获取行情数据...',
    encyclopedia: '正在从百科知识库查询概念定义...',
    academic: '正在从学术资源搜索研究论文...',
    government: '正在从政府和国际组织获取官方数据...',
    community: '正在从问答社区收集市场观点...',
  };

  return suggestions[category] || suggestions.general;
}
