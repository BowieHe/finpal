import { query } from '@/lib/db';
import { KarmaLogSchema, UserProfileSchema } from '@/lib/db-schema';
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
      const sql = `
        INSERT INTO karma_logs (source, type, content, interpretation, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      const result = await query(sql, [
        event.source,
        event.type,
        event.content,
        JSON.stringify(event.interpretation)
      ]);
      const record = KarmaLogSchema.parse(result.rows[0]);
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
    const result = await query(
      'SELECT * FROM karma_logs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(row => KarmaLogSchema.parse(row));
  }

  /**
   * 获取当前用户画像
   */
  static async getLatestProfile() {
    const result = await query(
      'SELECT * FROM user_profile ORDER BY version DESC LIMIT 1'
    );
    if (result.rows.length === 0) return null;
    return UserProfileSchema.parse(result.rows[0]);
  }
}
