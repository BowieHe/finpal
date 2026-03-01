export interface LLMConfig {
  apiUrl: string;
  modelName: string;
  apiKey: string;
  searchStrategy?: SearchStrategy;
}

export type SearchStrategy = 'smart' | 'duckduckgo' | 'aliyun-websearch' | 'open-websearch';

export type Theme = 'light' | 'dark';
