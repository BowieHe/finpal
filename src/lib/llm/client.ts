import { ChatOpenAI } from '@langchain/openai';
import { LLMConfig } from '@/types/config';
import { createLogger } from '../logger';

const logger = createLogger('LLMClient');

let currentLLM: ChatOpenAI | null = null;

// 安全的配置获取，提供有意义的默认值
const getSafeConfig = (): LLMConfig => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set, LLM calls will fail');
  }

  return {
    apiUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
    modelName: process.env.OPENAI_MODEL || 'deepseek-chat',
    apiKey: apiKey || '',
    searchStrategy: (process.env.DEFAULT_SEARCH_ENGINE as LLMConfig['searchStrategy']) || 'smart',
  };
};

export const defaultLLMConfig: LLMConfig = getSafeConfig();

/**
 * 创建 LLM 客户端
 * 注意：如果 apiKey 为空，会抛出错误
 */
export function createLLMClient(config: LLMConfig): ChatOpenAI {
  if (!config.apiKey) {
    throw new Error(
      '[LLM Client] API Key is required. Please set OPENAI_API_KEY environment variable.'
    );
  }

  logger.info('Creating LLM client', {
    hasApiKey: true,
    apiKeyLength: config.apiKey.length,
    apiUrl: config.apiUrl,
    modelName: config.modelName,
  });

  const client = new ChatOpenAI({
    apiKey: config.apiKey,
    configuration: {
      baseURL: config.apiUrl,
    },
    temperature: 0.7,
    model: config.modelName,
    maxRetries: 3, // LangChain 内置重试
    timeout: 60000, // 60 秒超时
  });

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

/**
 * 带指数退避的重试调用
 * @param operation 要执行的操作
 * @param maxRetries 最大重试次数
 * @param baseDelay 基础延迟（毫秒）
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw new Error(
          `[Retry] Failed after ${maxRetries + 1} attempts: ${lastError.message}`
        );
      }

      // 指数退避：1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Attempt ${attempt + 1} failed, retrying`, { delay, error: lastError.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// 注意：不要在模块加载时初始化，改为按需获取
// export const llm = getLLMInstance(); // 已移除
