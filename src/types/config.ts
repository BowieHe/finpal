export interface LLMConfig {
  apiUrl: string;
  modelName: string;
  apiKey: string;
  dashscopeApiKey?: string; // 阿里云百炼 MCP 的 API Key
}

export type Theme = 'light' | 'dark';
