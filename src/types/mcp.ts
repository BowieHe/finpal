export type SearchEngine = 'brave' | 'tavily';

export interface MCPConfig {
  name: SearchEngine;
  apiUrl: string;
  apiKey: string;
  maxResults: number;
  env: Record<string, string>;
}

export interface SearchResult {
  query: string;
  engine: SearchEngine | 'error';
  results: any[];
  timestamp: number;
  reasoning: string;
  duration?: number;
}

export interface SearchEngineUsage {
  brave: number;
  tavily: number;
}

export const PLACEHOLDER_RESULT: SearchResult = {
  query: '',
  engine: 'error',
  results: [],
  timestamp: Date.now(),
  reasoning: '搜索失败，请稍后重试（占位符）',
};
