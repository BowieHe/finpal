/**
 * Fund Debate Skill
 * 
 * 基于已有的研究数据进行多空辩论分析
 */

import { getLLMInstance } from '@/lib/llm/client';
import { createLogger } from '@/lib/logger';
import { ISkill, SkillMetadata, FundDebateInput, FundDebateData, FundDeepSearchData } from '../types';
import { SkillInput, SkillOutput } from '../../core/types';

const logger = createLogger('FundDebateSkill');

/**
 * Skill 元数据
 */
const METADATA: SkillMetadata = {
  name: 'fund-debate',
  description: '基于基金研究数据进行多空辩论分析，生成看多/看空观点和综合建议。当已有足够数据时使用此技能。',
  version: '1.0.0',
  triggers: ['分析', '辩论', '多空', '观点', '建议'],
  requiredTools: ['llm'],
  outputSchema: 'fund_debate_package',
};

/**
 * 构建 Debate Prompt
 */
function buildDebatePrompt(entity: string, researchData: FundDeepSearchData): string {
  const fundInfo = researchData.fundInfo || {};
  const news = researchData.news || [];
  const risks = researchData.risks || [];
  
  return `你是专业的投资分析师。请基于以下研究数据，进行多空辩论分析。

## 分析对象
名称: ${entity}
${fundInfo.code ? `代码: ${fundInfo.code}` : ''}
${fundInfo.type ? `类型: ${fundInfo.type}` : '类型: 待确认'}

## 研究数据

### 基本信息
${JSON.stringify(fundInfo, null, 2)}

### 相关新闻 (${news.length} 条)
${news.map((n, i) => `${i + 1}. [${n.sentiment === 'positive' ? '利好' : n.sentiment === 'negative' ? '利空' : '中性'}] ${n.title}`).join('\n')}

### 风险因素 (${risks.length} 条)
${risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## 分析要求

请从看多和看空两个角度进行深入分析：

1. **看多观点 (Bull Case)**
   - 投资逻辑
   - 潜在催化剂
   - 目标价位 (如有)
   - 置信度 (0-100)

2. **看空观点 (Bear Case)**
   - 风险逻辑
   - 关键风险因素
   - 下行风险
   - 置信度 (0-100)

3. **综合建议**
   - 投资建议 (strong_buy/buy/hold/reduce/sell/info_only)
   - 确信度 (0-100)
   - 关键决策因素
   - 时间框架
   - 一句话总结

4. **期望值计算 (EV)**
   - 乐观情景: 概率和收益率
   - 基准情景: 概率和收益率
   - 悲观情景: 概率和收益率
   - 综合期望收益率

请输出 JSON 格式：

{\n  "bullCase": {\n    "thesis": "看多逻辑...",\n    "catalysts": ["催化剂1", "催化剂2"],\n    "targetPrice": 100,\n    "confidence": 75\n  },\n  "bearCase": {\n    "thesis": "看空逻辑...",\n    "risks": ["风险1", "风险2"],\n    "downsidePrice": 80,\n    "confidence": 60\n  },\n  "synthesis": {\n    "recommendation": "hold",\n    "conviction": 65,\n    "keyFactors": ["因素1", "因素2"],\n    "timeHorizon": "6-12个月",\n    "summary": "一句话总结..."\n  },\n  "evCalculation": {\n    "upsideScenario": { "probability": 0.3, "return": 0.2 },\n    "baseScenario": { "probability": 0.5, "return": 0.05 },\n    "downsideScenario": { "probability": 0.2, "return": -0.1 },\n    "expectedReturn": 0.055\n  }\n}`;
}

/**
 * 解析 LLM 输出
 */
function parseDebateOutput(content: string): FundDebateData | null {
  try {
    // 尝试直接解析
    return JSON.parse(content);
  } catch {
    // 尝试提取 JSON 代码块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || 
                      content.match(/```\s*([\s\S]*?)```/) ||
                      content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch {
        // 忽略
      }
    }
  }
  
  return null;
}

/**
 * 生成默认输出 (解析失败时使用)
 */
function generateDefaultOutput(entity: string): FundDebateData {
  return {
    bullCase: {
      thesis: `基于现有信息，${entity} 具有一定的投资价值，但需要更多数据支撑具体分析。`,
      catalysts: ['待进一步研究'],
      confidence: 50,
    },
    bearCase: {
      thesis: `${entity} 存在不确定性，建议谨慎对待。`,
      risks: ['信息不完整', '需要更多数据'],
      confidence: 50,
    },
    synthesis: {
      recommendation: 'info_only',
      conviction: 50,
      keyFactors: ['数据不完整'],
      timeHorizon: '不确定',
      summary: `由于数据限制，无法给出明确的投资建议，建议补充更多信息后再做分析。`,
    },
  };
}

/**
 * 计算整体置信度
 */
function calculateOverallConfidence(data: FundDebateData): number {
  const bullConf = data.bullCase.confidence || 50;
  const bearConf = data.bearCase.confidence || 50;
  const synthesisConf = data.synthesis.conviction || 50;
  
  // 取三个置信度的加权平均
  return (bullConf * 0.3 + bearConf * 0.3 + synthesisConf * 0.4) / 100;
}

/**
 * Fund Debate Skill 实现
 */
export class FundDebateSkill implements ISkill {
  readonly metadata = METADATA;

  async execute(input: SkillInput): Promise<SkillOutput> {
    const startTime = Date.now();
    const typedInput = input as FundDebateInput;
    
    logger.info('Executing fund-debate', { 
      entity: typedInput.entity,
      hasResearchData: !!typedInput.researchData,
    });

    try {
      // 获取 LLM
      const llm = await getLLMInstance();
      
      // 构建 Prompt
      const prompt = buildDebatePrompt(
        typedInput.entity,
        typedInput.researchData
      );

      // 调用 LLM
      const response = await llm.invoke(prompt);
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      // 解析输出
      let debateData = parseDebateOutput(content);
      
      if (!debateData) {
        logger.warn('Failed to parse debate output, using default');
        debateData = generateDefaultOutput(typedInput.entity);
      }

      // 计算置信度
      const confidence = calculateOverallConfidence(debateData);
      debateData.synthesis.conviction = Math.round(confidence * 100);

      const durationMs = Date.now() - startTime;

      logger.info('Fund debate completed', {
        entity: typedInput.entity,
        recommendation: debateData.synthesis.recommendation,
        conviction: debateData.synthesis.conviction,
        duration: durationMs,
      });

      // 检测缺口 (debate 阶段通常信息已充足)
      const gaps: string[] = [];
      if (debateData.bullCase.confidence < 60) {
        gaps.push('看多观点置信度不足');
      }
      if (debateData.bearCase.confidence < 60) {
        gaps.push('看空观点置信度不足');
      }

      return {
        success: true,
        data: debateData,
        confidence,
        completeness: 1.0, // Debate 阶段假设数据完整
        gaps,
        suggestions: ['分析完成'],
        metadata: {
          durationMs,
          toolsUsed: ['llm'],
        },
      };

    } catch (error) {
      logger.error('Fund debate failed', { 
        entity: typedInput.entity,
        error: String(error),
      });

      return {
        success: false,
        error: String(error),
        confidence: 0,
        completeness: 0,
        gaps: ['辩论分析执行失败'],
        suggestions: ['请检查 LLM 配置或稍后重试'],
        metadata: {
          durationMs: Date.now() - startTime,
          toolsUsed: ['llm'],
        },
      };
    }
  }
}

/**
 * Skill 实例
 */
export const fundDebateSkill = new FundDebateSkill();
export default fundDebateSkill;
