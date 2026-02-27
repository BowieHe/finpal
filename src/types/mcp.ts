export type SearchEngine = 'open-websearch' | 'duckduckgo' | 'playwright' | 'error';

export type QueryCategory =
  | 'general'           // 一般性问题
  | 'finance_news'      // 财经新闻/实时资讯
  | 'finance_data'      // 股票/基金/行情数据
  | 'encyclopedia'      // 百科知识
  | 'academic'          // 学术研究
  | 'government'        // 政府/国际组织数据
  | 'community';        // 问答社区

export interface QueryClassification {
  category: QueryCategory;
  confidence: number;
  reasoning: string;
  suggestedSources?: string[];
}

export interface MCPConfig {
  name: SearchEngine;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface SearchResultItem {
  title: string;
  url: string;
  description?: string;
  content?: string;
  source?: string;
  position?: number;
}

export interface SearchResult {
  query: string;
  engine: SearchEngine;
  results: SearchResultItem[];
  timestamp: number;
  reasoning: string;
  duration?: number;
  error?: boolean;
  category?: QueryCategory;
}

export interface SpecializedSource {
  name: string;
  url: string;
  category: QueryCategory;
  description: string;
  searchUrl?: string;
  selectors?: {
    results?: string;
    title?: string;
    description?: string;
    content?: string;
  };
}

export const PLACEHOLDER_RESULT: SearchResult = {
  query: '',
  engine: 'error',
  results: [],
  timestamp: Date.now(),
  reasoning: '搜索失败，请稍后重试（占位符）',
};
