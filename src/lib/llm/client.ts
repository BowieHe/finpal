import { ChatOpenAI } from '@langchain/openai';
import { LLMConfig } from '@/types/config';
import { createLogger } from '../logger';
import { getConfig, clearConfigCache, validateConfig } from '../config/manager';

const logger = createLogger('LLMClient');

/**
 * Get configuration from DB with in-memory caching
 * @deprecated Use getConfig from '@/lib/config/manager' instead
 */
export async function getPersistentConfig(): Promise<LLMConfig> {
  return await getConfig();
}

/**
 * Force refresh the configuration cache (e.g., after a settings update)
 */
export { clearConfigCache };

/**
 * Validate configuration and return detailed error info
 */
export { validateConfig };

/**
 * Create a new LLM client instance with the provided configuration
 */
export function createLLMClient(config: LLMConfig): ChatOpenAI {
  if (!config.apiKey || config.apiKey.trim() === '') {
    throw new Error(
      '[LLM Client] API Key is required. Please configure it in the settings.'
    );
  }

  logger.info('Creating LLM client', {
    hasApiKey: true,
    apiKeyLength: config.apiKey.length,
    apiKeyPrefix: config.apiKey.substring(0, 10) + '...',
    apiUrl: config.apiUrl,
    modelName: config.modelName,
  });

  // 重要：LangChain 会优先从环境变量读取 API Key
  // 我们需要在创建客户端前设置环境变量，确保传入的 apiKey 被使用
  process.env.OPENAI_API_KEY = config.apiKey;
  if (config.apiUrl) {
    process.env.OPENAI_BASE_URL = config.apiUrl;
  }

  // 确保 apiKey 被正确传递
  const client = new ChatOpenAI({
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.apiUrl,
    },
    temperature: 0.7,
    modelName: config.modelName,
    maxRetries: 3,
    timeout: 60000,
  });

  return client;
}

/**
 * Get an LLM instance. 
 * Note: Since we are moving away from global singleton to avoid race conditions,
 * this now returns a fresh instance based on the current persistent config.
 * For true request-scoping, use createLLMClient(config) directly.
 */
export async function getLLMInstance(): Promise<ChatOpenAI> {
  // 先验证配置
  const validation = await validateConfig();
  if (!validation.valid) {
    throw new Error(validation.message || 'Configuration validation failed');
  }

  logger.debug('getLLMInstance using config', {
    apiUrl: validation.config.apiUrl,
    modelName: validation.config.modelName,
    apiKeyLength: validation.config.apiKey.length,
  });

  return createLLMClient(validation.config);
}

/**
 * Retry helper with exponential backoff
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

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Attempt ${attempt + 1} failed, retrying`, { delay, error: lastError.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Streaming utility
 */
export async function streamWithCallback(
  prompt: string,
  onChunk: (chunk: string) => void,
  maxRetries: number = 2,
  llmOverride?: ChatOpenAI
): Promise<string> {
  let llm: ChatOpenAI;
  
  if (llmOverride) {
    llm = llmOverride;
  } else {
    // 获取 LLM 实例（会自动验证配置）
    llm = await getLLMInstance();
  }
  
  let fullContent = '';
  
  const operation = async () => {
    const stream = await llm.stream(prompt);
    
    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string' ? chunk.content : '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }
    
    return fullContent;
  };

  return withRetry(operation, maxRetries, 1000);
}
