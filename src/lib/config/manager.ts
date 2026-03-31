import { query } from '../db';
import { SettingsSchema } from '../db-schema';
import { createLogger } from '../logger';

const logger = createLogger('ConfigManager');

// 配置类型
export interface AppConfig {
  apiUrl: string;
  modelName: string;
  lightModelName?: string;
  apiKey: string;
  dashscopeApiKey?: string;
}

// 内存缓存
let cachedConfig: AppConfig | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 300000; // 5 minutes

const hardcodedFallbackConfig: AppConfig = {
  apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  modelName: 'qwen-vl-max',
  lightModelName: undefined,
  apiKey: '',
  dashscopeApiKey: undefined,
};

/**
 * 获取配置（带缓存）
 */
export async function getConfig(): Promise<AppConfig> {
  const now = Date.now();
  
  // 如果有缓存且未过期，直接返回
  if (cachedConfig && (now - lastFetchTime < CACHE_TTL)) {
    logger.debug('Returning cached config');
    return cachedConfig;
  }

  try {
    const result = await query('SELECT * FROM settings WHERE id = 1');
    const settingsRaw = result.rows[0];
    const settings = settingsRaw ? SettingsSchema.parse(settingsRaw) : null;

    const dbConfig: AppConfig | null = settings?.api_key
      ? {
          apiUrl: settings.api_url || hardcodedFallbackConfig.apiUrl,
          modelName: settings.model_name || hardcodedFallbackConfig.modelName,
          lightModelName: settings.light_model_name || undefined,
          apiKey: settings.api_key,
          dashscopeApiKey: settings.dashscope_api_key || undefined,
        }
      : null;

    if (dbConfig) {
      cachedConfig = dbConfig;
      logger.info('Config loaded from database', {
        hasApiKey: true,
        source: 'database',
        apiUrl: cachedConfig.apiUrl,
        modelName: cachedConfig.modelName,
      });
    } else {
      cachedConfig = { ...hardcodedFallbackConfig };
      logger.info('Config loaded from hardcoded fallback', {
        hasApiKey: !!cachedConfig.apiKey,
        source: 'fallback',
      });
    }
    
    lastFetchTime = now;
    return cachedConfig;
  } catch (error) {
    logger.error('Failed to load config from DB, using hardcoded fallback', { error: String(error) });
    return { ...hardcodedFallbackConfig };
  }
}

/**
 * 强制刷新缓存
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  lastFetchTime = 0;
  logger.info('Config cache cleared');
}

/**
 * 同步获取配置（仅用于已知有缓存的情况）
 */
export function getCachedConfig(): AppConfig | null {
  return cachedConfig;
}

/**
 * 验证配置是否完整
 * @returns { valid: boolean; missing: string[]; config: AppConfig }
 */
export async function validateConfig(): Promise<{ 
  valid: boolean; 
  missing: string[]; 
  config: AppConfig;
  message?: string;
}> {
  const config = await getConfig();
  const missing: string[] = [];
  
  if (!config.apiKey || config.apiKey.trim() === '') {
    missing.push('API Key');
  }
  
  if (!config.apiUrl || config.apiUrl.trim() === '') {
    missing.push('API URL');
  }
  
  if (!config.modelName || config.modelName.trim() === '') {
    missing.push('Model Name');
  }
  
  const valid = missing.length === 0;
  
  if (!valid) {
    logger.warn('Configuration validation failed', { missing });
    return {
      valid: false,
      missing,
      config,
      message: `配置缺失: ${missing.join(', ')}。请在设置页面配置 API Key 和其他必要信息。`,
    };
  }
  
  logger.debug('Configuration validation passed');
  return { valid: true, missing: [], config };
}
