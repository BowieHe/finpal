export interface LLMConfig {
  apiUrl: string;
  modelName: string;
  apiKey: string;
  lightModelName?: string; // 轻量级模型名称，用于自动总结等任务
  dashscopeApiKey?: string; // 阿里云百炼 MCP 的 API Key
}

export type Theme = 'light' | 'dark';
