import { ChatOpenAI } from '@langchain/openai';
import { LLMConfig } from '@/types/config';

let currentLLM: ChatOpenAI | null = null;

export const defaultLLMConfig: LLMConfig = {
  apiUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
  modelName: process.env.OPENAI_MODEL || 'deepseek-chat',
  apiKey: process.env.OPENAI_API_KEY || '',
};

export function createLLMClient(config: LLMConfig): ChatOpenAI {
  console.log('[LLM Client] Creating client with config:', {
    hasApiKey: !!config.apiKey,
    apiKeyLength: config.apiKey?.length,
    apiUrl: config.apiUrl,
    modelName: config.modelName,
  });

  const client = new ChatOpenAI({
    apiKey: config.apiKey,
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.apiUrl,
    },
    temperature: 0.7,
    model: config.modelName,
  });

  console.log('[LLM Client] Client created successfully');
  return client;
}

export function setLLMInstance(config: LLMConfig) {
  currentLLM = createLLMClient(config);
}

export function getLLMInstance(): ChatOpenAI {
  if (!currentLLM) {
    currentLLM = createLLMClient(defaultLLMConfig);
  }
  return currentLLM;
}

export const llm = getLLMInstance();
