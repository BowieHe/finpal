import { LLMConfig } from '@/types/config';
import { defaultLLMConfig } from '@/lib/llm/client';

const STORAGE_KEY = 'finpal_llm_config';

export function getLLMConfig(): LLMConfig {
  if (typeof window === 'undefined') {
    return defaultLLMConfig;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      let config = JSON.parse(stored);

      // Migrate old configuration
      let needsUpdate = false;

      // Fix old URL format
      if (config.apiUrl === 'https://api.deepseek.com/v1') {
        config.apiUrl = 'https://api.deepseek.com';
        needsUpdate = true;
      }

      // Fix old model name
      if (config.modelName === 'deepseek-reasoner') {
        config.modelName = 'deepseek-chat';
        needsUpdate = true;
      }

      // Add default search strategy if not present
      if (!config.searchStrategy) {
        config.searchStrategy = 'smart';
        needsUpdate = true;
      }

      // Update if changed
      if (needsUpdate) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        console.log('[Config] Migrated old configuration to new format:', config);
      }

      return config;
    }
  } catch (error) {
    console.error('Failed to read LLM config from localStorage:', error);
  }

  return defaultLLMConfig;
}

export function setLLMConfig(config: LLMConfig): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save LLM config to localStorage:', error);
  }
}
