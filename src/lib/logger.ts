/**
 * 结构化日志系统
 * 提供统一的日志格式，支持时间戳、模块名、级别和数据
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  duration?: number;
}

/**
 * 日志配置
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 全局配置
let globalConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  enableConsole: true,
};

/**
 * 设置全局日志配置
 */
export function setLoggerConfig(config: Partial<LoggerConfig>) {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * 检查日志级别是否应该被记录
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[globalConfig.level];
}

/**
 * 格式化日志条目为字符串
 */
function formatLogEntry(entry: LogEntry): string {
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  const durationStr = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}${durationStr}${dataStr}`;
}

/**
 * 日志记录器类
 */
export class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  /**
   * 内部日志记录方法
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>, duration?: number) {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      data,
      duration,
    };

    if (globalConfig.enableConsole) {
      const formatted = formatLogEntry(entry);

      switch (level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.log(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          break;
      }
    }

    // 可扩展：发送到日志服务或保存到文件
    // 例如：sendToLogService(entry);

    return entry;
  }

  /**
   * 调试级别日志
   */
  debug(message: string, data?: Record<string, unknown>) {
    return this.log('debug', message, data);
  }

  /**
   * 信息级别日志
   */
  info(message: string, data?: Record<string, unknown>) {
    return this.log('info', message, data);
  }

  /**
   * 警告级别日志
   */
  warn(message: string, data?: Record<string, unknown>) {
    return this.log('warn', message, data);
  }

  /**
   * 错误级别日志
   */
  error(message: string, data?: Record<string, unknown>) {
    return this.log('error', message, data);
  }

  /**
   * 计时执行函数并记录耗时
   */
  async timed<T>(operation: string, fn: () => Promise<T>, data?: Record<string, unknown>): Promise<T> {
    const start = Date.now();
    this.debug(`${operation} started`, data);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { ...data, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error(`${operation} failed`, { ...data, duration, error: errorMessage });
      throw error;
    }
  }

  /**
   * 同步版本的计时执行
   */
  timedSync<T>(operation: string, fn: () => T, data?: Record<string, unknown>): T {
    const start = Date.now();
    this.debug(`${operation} started`, data);

    try {
      const result = fn();
      const duration = Date.now() - start;
      this.info(`${operation} completed`, { ...data, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.error(`${operation} failed`, { ...data, duration, error: errorMessage });
      throw error;
    }
  }
}

/**
 * 创建日志记录器实例的工厂函数
 */
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// 默认导出
export default Logger;
