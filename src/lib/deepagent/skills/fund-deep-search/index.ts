/**
 * Fund Deep Search Skill
 * 
 * 封装现有的 webAgent，提供标准化的 Skill 接口
 */

import { webAgent } from '@/lib/agents/web-agent';
import { smartSearch, batchSearch } from '@/lib/mcp/unified-search';
import { createLogger } from '@/lib/logger';
import { ISkill, SkillMetadata, FundDeepSearchInput, FundDeepSearchData } from '../types';
import { SkillInput, SkillOutput } from '../../core/types';

const logger = createLogger('FundDeepSearchSkill');

/**
 * Skill 元数据
 */
const METADATA: SkillMetadata = {
  name: 'fund-deep-search',
  description: '为基金分析执行深度信息检索，覆盖财报、新闻、竞品、风险信号。当需要收集基金信息时使用此技能。',
  version: '1.0.0',
  triggers: ['搜索基金', '查基金', '找基金信息', '分析基金', '研究基金'],
  requiredTools: ['web_search'],
  outputSchema: 'fund_research_package',
};

/**
 * 计算置信度
 */
function calculateConfidence(data: FundDeepSearchData): number {
  let score = 0;
  
  // 基础信息 (最高 0.3)
  if (data.fundInfo.name) score += 0.15;
  if (data.fundInfo.code) score += 0.1;
  if (data.fundInfo.type) score += 0.05;
  
  // 财务数据 (最高 0.25)
  if (data.financials?.latestReport) score += 0.15;
  if (data.financials?.revenue || data.financials?.profit) score += 0.1;
  
  // 新闻 (最高 0.2)
  if (data.news.length >= 5) score += 0.2;
  else if (data.news.length >= 3) score += 0.15;
  else if (data.news.length > 0) score += 0.1;
  
  // 风险信息 (最高 0.15)
  if (data.risks.length >= 3) score += 0.15;
  else if (data.risks.length > 0) score += 0.1;
  
  // 数据来源多样性 (最高 0.1)
  if (data.sources.length >= 5) score += 0.1;
  else if (data.sources.length >= 3) score += 0.05;
  
  return Math.min(score, 1.0);
}

/**
 * 检测信息缺口
 */
function detectGaps(data: FundDeepSearchData): string[] {
  const gaps: string[] = [];
  
  if (!data.financials?.latestReport) {
    gaps.push('缺少最新财报数据');
  }
  
  if (data.news.length === 0) {
    gaps.push('缺少最新新闻动态');
  } else if (data.news.length < 3) {
    gaps.push('新闻数量较少');
  }
  
  if (!data.fundInfo.aum && !data.fundInfo.nav) {
    gaps.push('缺少基金规模/净值信息');
  }
  
  if (data.risks.length === 0) {
    gaps.push('未识别风险因素');
  }
  
  if (!data.fundInfo.manager) {
    gaps.push('缺少基金经理信息');
  }
  
  return gaps;
}

/**
 * 生成建议
 */
function generateSuggestions(data: FundDeepSearchData, gaps: string[]): string[] {
  const suggestions: string[] = [];
  
  if (gaps.includes('缺少最新财报数据')) {
    suggestions.push('建议补充搜索财报数据');
  }
  
  if (gaps.includes('缺少最新新闻动态')) {
    suggestions.push('建议扩大新闻搜索范围');
  }
  
  if ((data.confidence || 0) > 0.6) {
    suggestions.push('数据充足，可以进入分析阶段');
  } else {
    suggestions.push('建议继续补充信息');
  }
  
  return suggestions;
}

/**
 * 执行多维度搜索
 */
async function performMultiSearch(entity: string, focus?: string[]): Promise<FundDeepSearchData> {
  const startTime = Date.now();
  const searchQueries: string[] = [];
  const sources: string[] = [];
  
  // 基础搜索
  searchQueries.push(`${entity} 基金 最新`);
  
  // 根据 focus 添加搜索
  if (!focus || focus.includes('financial')) {
    searchQueries.push(`${entity} 基金 财报 业绩`);
  }
  if (!focus || focus.includes('news')) {
    searchQueries.push(`${entity} 基金 新闻 最新动态`);
  }
  if (!focus || focus.includes('risk')) {
    searchQueries.push(`${entity} 基金 风险`);
  }
  if (!focus || focus.includes('manager')) {
    searchQueries.push(`${entity} 基金 基金经理`);
  }

  logger.info('Starting multi-search', { entity, queries: searchQueries });

  // 批量搜索
  const searchResults = await batchSearch(searchQueries);
  
  // 收集来源
  searchResults.forEach(result => {
    result.results.forEach(item => {
      if (item.url && !sources.includes(item.url)) {
        sources.push(item.url);
      }
    });
  });

  // 整理新闻
  const news: FundDeepSearchData['news'] = [];
  searchResults.forEach(result => {
    result.results.slice(0, 3).forEach(item => {
      const title = item.title || '';
      const desc = item.description || '';
      
      // 简单情感分析
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      const positiveWords = ['上涨', '增长', '利好', '优秀', '领先'];
      const negativeWords = ['下跌', '亏损', '风险', '警示', '落后'];
      
      const text = title + desc;
      if (positiveWords.some(w => text.includes(w))) sentiment = 'positive';
      else if (negativeWords.some(w => text.includes(w))) sentiment = 'negative';
      
      news.push({
        title,
        source: item.url,
        sentiment,
        summary: desc?.substring(0, 100),
      });
    });
  });

  // 提取风险关键词
  const riskKeywords = ['风险', '亏损', '下跌', '回撤', '波动', '警示', '关注'];
  const risks: string[] = [];
  
  searchResults.forEach(result => {
    result.results.forEach(item => {
      const text = (item.title + ' ' + item.description).toLowerCase();
      riskKeywords.forEach(keyword => {
        if (text.includes(keyword) && !risks.some(r => text.includes(r))) {
          const snippet = item.description?.substring(0, 80) || item.title;
          if (snippet) risks.push(snippet);
        }
      });
    });
  });

  // 尝试获取基金代码
  const fundCodeMatch = entity.match(/(\d{6})/);
  const fundCode = fundCodeMatch ? fundCodeMatch[1] : undefined;

  // 如果提供了基金代码，尝试获取更详细的信息
  let detailedInfo: any = {};
  if (fundCode) {
    try {
      const webResult = await webAgent({
        task: 'fund_info',
        params: { fundCode, query: entity },
      });
      
      if (webResult.status === 'success') {
        // 从 webAgent 结果提取信息
        detailedInfo = {
          rawSnippets: webResult.rawSnippets,
          summary: webResult.summary,
        };
      }
    } catch (error) {
      logger.warn('Failed to get detailed fund info', { error: String(error) });
    }
  }

  const data: FundDeepSearchData = {
    fundInfo: {
      name: entity,
      code: fundCode,
    },
    news: news.slice(0, 10), // 最多10条
    risks: risks.slice(0, 5), // 最多5条
    sources: sources.slice(0, 10),
    searchResults,
    searchQueries,
  };

  // 如果有详细数据，合并
  if (detailedInfo.summary) {
    data.fundInfo.type = detailedInfo.summary.includes('股票') ? '股票型' : 
                         detailedInfo.summary.includes('债券') ? '债券型' : 
                         detailedInfo.summary.includes('混合') ? '混合型' : '未知';
  }

  logger.info('Multi-search completed', { 
    duration: Date.now() - startTime,
    newsCount: news.length,
    riskCount: risks.length,
    sourceCount: sources.length,
  });

  return data;
}

/**
 * Fund Deep Search Skill 实现
 */
export class FundDeepSearchSkill implements ISkill {
  readonly metadata = METADATA;

  async execute(input: SkillInput): Promise<SkillOutput> {
    const startTime = Date.now();
    const typedInput = input as FundDeepSearchInput;
    
    logger.info('Executing fund-deep-search', { 
      entity: typedInput.entity,
      focus: typedInput.focus,
      depth: typedInput.depth,
    });

    try {
      // 执行搜索
      const data = await performMultiSearch(
        typedInput.entity,
        typedInput.focus
      );

      // 计算置信度和缺口
      const confidence = calculateConfidence(data);
      const gaps = detectGaps(data);
      const suggestions = generateSuggestions(data, gaps);

      // 更新数据中的置信度
      data.confidence = confidence;

      const durationMs = Date.now() - startTime;

      logger.info('Fund deep search completed', {
        entity: typedInput.entity,
        confidence,
        gaps: gaps.length,
        duration: durationMs,
      });

      return {
        success: true,
        data,
        confidence,
        completeness: 1 - (gaps.length / 6), // 6个关键字段
        gaps,
        suggestions,
        metadata: {
          durationMs,
          toolsUsed: ['web_search', 'web_agent'],
          sources: data.sources,
        },
      };

    } catch (error) {
      logger.error('Fund deep search failed', { 
        entity: typedInput.entity,
        error: String(error),
      });

      return {
        success: false,
        error: String(error),
        confidence: 0,
        completeness: 0,
        gaps: ['搜索执行失败'],
        suggestions: ['请检查网络连接或稍后重试'],
        metadata: {
          durationMs: Date.now() - startTime,
          toolsUsed: ['web_search'],
        },
      };
    }
  }
}

/**
 * Skill 实例
 */
export const fundDeepSearchSkill = new FundDeepSearchSkill();
export default fundDeepSearchSkill;
