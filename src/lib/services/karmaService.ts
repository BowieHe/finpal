import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
const logger = createLogger('KarmaService');

export type KarmaSource = 'screenshot' | 'chat' | 'analysis';
export type KarmaType = 'behavior' | 'emotion' | 'interest';

export interface KarmaEvent {
  source: KarmaSource;
  type: KarmaType;
  content: string;
  interpretation: any;
}

/**
 * 业力服务 (KarmaService)
 * 负责记录所有影响用户画像的事件，并支持后续的人物演化分析。
 */
export class KarmaService {
  /**
   * 记录一个业力事件
   */
  static async logEvent(event: KarmaEvent) {
    try {
      const record = await prisma.karmaLog.create({
        data: {
          source: event.source,
          type: event.type,
          content: event.content,
          interpretation: event.interpretation,
        },
      });
      logger.info('Karma event logged', { id: record.id, type: event.type });
      return record;
    } catch (error: any) {
      logger.error('Failed to log karma event', {
        error: error.message || error,
        stack: error.stack,
        event
      });
      throw error;
    }
  }

  /**
   * 获取最近的业力日志以供分析
   */
  static async getRecentLogs(limit = 20) {
    return prisma.karmaLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 获取当前用户画像
   */
  static async getLatestProfile() {
    return prisma.userProfile.findFirst({
      orderBy: { version: 'desc' },
    });
  }
}
