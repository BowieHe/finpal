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
      return JSON.parse(stored);
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
