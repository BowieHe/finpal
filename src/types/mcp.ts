export type SearchEngine = 'bailian-websearch' | 'error';

export type QueryCategory =
  | 'general'
  | 'finance_news'
  | 'finance_data'
  | 'encyclopedia'
  | 'academic'
  | 'government'
  | 'community';

export interface MCPConfig {
  name: SearchEngine;
  // For HTTP transport (Bailian)
  url?: string;
  headers?: Record<string, string>;
  // For Stdio transport (legacy)
  command?: string;
  args?: string[];
  env?: Record<string, string>;
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

export const PLACEHOLDER_RESULT: SearchResult = {
  query: '',
  engine: 'error',
  results: [],
  timestamp: Date.now(),
  reasoning: '搜索失败，请稍后重试（占位符）',
};

export interface MCPQuery {
  query: string;
  category?: QueryCategory;
}
