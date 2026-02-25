import { ChatOpenAI } from '@langchain/openai';
import { LLMConfig } from '@/types/config';

let currentLLM: ChatOpenAI | null = null;

export const defaultLLMConfig: LLMConfig = {
  apiUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1',
  modelName: process.env.OPENAI_MODEL || 'deepseek-reasoner',
  apiKey: process.env.OPENAI_API_KEY || '',
};

export function createLLMClient(config: LLMConfig): ChatOpenAI {
  return new ChatOpenAI({
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.apiUrl,
    },
    temperature: 0.7,
    model: config.modelName,
  });
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
