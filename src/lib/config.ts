import { LLMConfig } from '@/types/config';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ConfigFrontend');
const STORAGE_KEY = 'finpal_llm_config';

/**
 * 从 localStorage 获取配置（前端使用）
 * 注意：实际 API Key 存储在服务端数据库，前端只存储非敏感信息
 */
export function getLLMConfig(): LLMConfig {
  if (typeof window === 'undefined') {
    // 服务端渲染时返回空配置
    return {
      apiUrl: '',
      modelName: '',
      apiKey: '',
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      let config = JSON.parse(stored);

      // Migrate old configuration
      let needsUpdate = false;

      // Fix old DeepSeek URLs and migrate to DashScope
      if (config.apiUrl?.includes('deepseek.com')) {
        config.apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        needsUpdate = true;
      }

      // Fix old model names and migrate to qwen3.5-plus
      if (config.modelName === 'deepseek-chat' || config.modelName === 'deepseek-reasoner') {
        config.modelName = 'qwen3.5-plus';
        needsUpdate = true;
      }

      // Update if changed
      if (needsUpdate) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        logger.info('Migrated old configuration to new format', { config });
      }

      return config;
    }
  } catch (error) {
    logger.error('Failed to read LLM config from localStorage', { error: String(error) });
  }

  // 默认返回硬编码配置（首次使用时的默认值）
  return {
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-vl-max',
    apiKey: '',
  };
}

export function setLLMConfig(config: LLMConfig): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    logger.error('Failed to save LLM config to localStorage', { error: String(error) });
  }
}
