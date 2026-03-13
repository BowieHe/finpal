import { PrismaClient } from '@prisma/client';
import { createLogger } from '@/lib/logger';
import { KarmaService } from './karmaService';
import OpenAI from 'openai';

const prisma = new PrismaClient();
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
      
      // 读取未处理的日志
      const logs = await prisma.karmaLog.findMany({
        where: force ? {} : {
          createdAt: {
            gt: latestProfile?.updatedAt || new Date(0)
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (logs.length === 0 && !force) {
        logger.info('No new karma logs to synthesize');
        return latestProfile;
      }

      logger.info(`Synthesizing profile from ${logs.length} logs...`);

      // 调用 LLM 进行合成
      const updatedData = await this.callSynthesisLLM(latestProfile, logs);

      // 写入新版本
      const newProfile = await prisma.userProfile.create({
        data: {
          version: lastVersion + 1,
          persona: updatedData.persona,
          styles: updatedData.styles,
          biases: updatedData.biases,
          evolutionaryLog: updatedData.evolutionaryLog,
          summary: updatedData.summary,
        }
      });

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
    // 这里模拟 LLM 调用，实际应通过 OpenAI 客户端
    // 由于环境限制，这里先实现逻辑框架，你可以根据实际 API 配置
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

    // 实际调用逻辑
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    });

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'qwen-plus',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }
}
