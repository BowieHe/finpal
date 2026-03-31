import { query } from '@/lib/db';
import { KarmaLogSchema, UserProfileSchema } from '@/lib/db-schema';
import { createLogger } from '@/lib/logger';
import { KarmaService } from './karmaService';
import { createLLMClient, streamWithCallback } from '@/lib/llm/client';
import { getConfig } from '@/lib/config/manager';
const logger = createLogger('SynthesisService');

export class SynthesisService {
  /**
   * 触发画像合成
   * @param force 是否强制重新合成所有记录
   */
  static async synthesizeProfile(force = false) {
    try {
      const latestProfile = await KarmaService.getLatestProfile();
      const lastVersion = latestProfile?.version || 0;
      
      let logs;
      if (force) {
        const result = await query('SELECT * FROM karma_logs ORDER BY created_at ASC');
        logs = result.rows.map(row => KarmaLogSchema.parse(row));
      } else {
        const lastUpdate = latestProfile?.updated_at || new Date(0);
        const result = await query(
          'SELECT * FROM karma_logs WHERE created_at > $1 ORDER BY created_at ASC',
          [lastUpdate]
        );
        logs = result.rows.map(row => KarmaLogSchema.parse(row));
      }

      if (logs.length === 0 && !force) {
        logger.info('No new karma logs to synthesize');
        return latestProfile;
      }

      logger.info(`Synthesizing profile from ${logs.length} logs...`);

      // 调用 LLM 进行合成
      const updatedData = await this.callSynthesisLLM(latestProfile, logs);

      // 写入新版本
      const sql = `
        INSERT INTO user_profile (version, persona, styles, biases, evolutionary_log, summary, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      const insertResult = await query(sql, [
        lastVersion + 1,
        updatedData.persona,
        JSON.stringify(updatedData.styles),
        updatedData.biases, // Zod handles string array
        updatedData.evolutionaryLog,
        updatedData.summary,
      ]);
      const newProfile = UserProfileSchema.parse(insertResult.rows[0]);

      logger.info('User profile updated successfully', { version: newProfile.version });
      return newProfile;
    } catch (error: any) {
      logger.error('Failed to synthesize profile', { 
        error: error.message || error,
        stack: error.stack
      });
      throw error;
    }
  }

  private static async callSynthesisLLM(currentProfile: any, logs: any[]) {
    const evidence = logs.map(l => `- [${l.source}] ${l.content}: ${JSON.stringify(l.interpretation)}`).join('\n');
    
    const prompt = `
你是一个专业的投资心理学家和财富管理专家。
当前的投资画像如下:
${currentProfile ? JSON.stringify(currentProfile, null, 2) : '暂无历史画像'}

新识别到的投资行为/证据如下:
${evidence}

请结合历史画像和新证据，生成更新后的画像。
要求：
1. 分析用户的行为是否有持续性。
2. 识别潜在的偏差（如追涨杀跌、过度自信等）。
3. 风格分布 (styles) 请返回 JSON 格式的分值 (0-100)。
4. 演进日志 (evolutionaryLog) 描述这次画像发生了什么变化。

请返回 JSON 代码块：
{
  "persona": "核心底色描述",
  "styles": { "aggression": 80, "rationality": 60, "risk_tolerance": 70 },
  "biases": ["锚定效应", "近因偏差"],
  "evolutionaryLog": "用户在最近三次调仓中表现出了更强的止盈意识...",
  "summary": "综合性描述"
}
`;

    const config = await getConfig();
    const modelToUse = config.lightModelName || config.modelName;
    const llm = createLLMClient({
      ...config,
      modelName: modelToUse,
    });

    logger.info('Running profile synthesis LLM', {
      modelName: modelToUse,
      apiUrl: config.apiUrl,
      logCount: logs.length,
    });

    const response = await streamWithCallback(
      `${prompt}\n\n只输出 JSON 对象，不要输出 Markdown 代码块。`,
      () => {},
      0,
      llm
    );

    const cleaned = response.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned || '{}');
  }
}
