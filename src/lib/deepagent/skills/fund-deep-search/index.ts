/**
 * Fund Deep Search Skill
 *
 * 为基金/资产分析执行深度信息检索，支持基于信息缺口的查询优化
 */

import { webAgent } from '@/lib/agents/web-agent';
import { smartSearch } from '@/lib/mcp/unified-search';
import { createLogger } from '@/lib/logger';
import { ISkill, SkillMetadata, FundDeepSearchInput, FundDeepSearchData } from '../types';
import { SkillInput, SkillOutput, ProgressEvent } from '../../core/types';

const logger = createLogger('FundDeepSearchSkill');

/**
 * Skill 元数据
 */
const METADATA: SkillMetadata = {
  name: 'fund-deep-search',
  description: '为基金/资产分析执行深度信息检索，覆盖财报、新闻、竞品、风险信号。支持基于信息缺口的查询优化。',
  version: '2.0.0',
  triggers: ['搜索基金', '查基金', '找基金信息', '分析基金', '研究基金', '搜索黄金', '分析资产'],
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
 * 基于信息缺口和 focus 生成优化查询
 */
function generateOptimizedQueries(
  entity: string,
  focus?: string[],
  previousGaps?: string[],
  isRetry: boolean = false
): string[] {
  const queries: string[] = [];
  const optimizedFor: string[] = [];

  // 基础查询 - 根据 entity 类型调整
  const isFund = /\d{6}/.test(entity); // 基金代码格式
  const isAsset = /黄金|白银|原油|比特币|美股|港股|A股/i.test(entity);

  if (isRetry && previousGaps && previousGaps.length > 0) {
    // 基于缺口生成针对性查询
    logger.info('Generating optimized queries based on gaps', { gaps: previousGaps });

    if (previousGaps.some(g => g.includes('财报') || g.includes('业绩'))) {
      if (isFund) {
        queries.push(`${entity} 基金 2024 2025 财报 年报 季报`);
        queries.push(`${entity} 基金 业绩 收益 净值增长`);
      } else {
        queries.push(`${entity} 价格走势 历史数据`);
        queries.push(`${entity} 市场表现 收益分析`);
      }
      optimizedFor.push('财务数据');
    }

    if (previousGaps.some(g => g.includes('新闻') || g.includes('动态'))) {
      queries.push(`${entity} 今天 本周 最新 新闻 动态`);
      queries.push(`${entity} 最新消息 市场分析`);
      optimizedFor.push('新闻动态');
    }

    if (previousGaps.some(g => g.includes('风险') || g.includes('回撤'))) {
      queries.push(`${entity} 风险 下跌 回撤 波动 警示`);
      queries.push(`${entity} 风险评估 安全性分析`);
      optimizedFor.push('风险评估');
    }

    if (previousGaps.some(g => g.includes('经理') || g.includes('管理'))) {
      queries.push(`${entity} 基金经理 业绩 履历 管理风格`);
      optimizedFor.push('基金经理');
    }

    if (previousGaps.some(g => g.includes('规模') || g.includes('净值'))) {
      queries.push(`${entity} 基金规模 净值 资产规模`);
      optimizedFor.push('规模净值');
    }
  }

  // 根据 focus 添加查询（如果不是 retry 或 focus 有特定要求）
  if (!isRetry || queries.length === 0) {
    // 基础查询
    if (isFund) {
      queries.push(`${entity} 基金 最新`);
    } else {
      queries.push(`${entity} 最新 价格 走势`);
    }

    if (!focus || focus.includes('financial')) {
      if (isFund) {
        queries.push(`${entity} 基金 财报 业绩`);
      } else {
        queries.push(`${entity} 投资分析 收益`);
      }
    }
    if (!focus || focus.includes('news')) {
      queries.push(`${entity} ${isFund ? '基金' : ''} 新闻 最新动态`);
    }
    if (!focus || focus.includes('risk')) {
      queries.push(`${entity} ${isFund ? '基金' : ''} 风险`);
    }
    if ((!focus || focus.includes('manager')) && isFund) {
      queries.push(`${entity} 基金 基金经理`);
    }
  }

  // 针对资产类型的特殊查询
  if (isAsset && !isFund) {
    if (!focus || focus.includes('macro')) {
      queries.push(`${entity} 宏观经济 政策影响 美联储`);
    }
    if (!focus || focus.includes('technical')) {
      queries.push(`${entity} 技术分析 支撑位 阻力位`);
    }
  }

  // 去重并返回
  const uniqueQueries = [...new Set(queries)];
  logger.info('Generated optimized queries', {
    total: uniqueQueries.length,
    optimizedFor,
    isRetry,
    gaps: previousGaps
  });

  return uniqueQueries;
}

/**
 * 执行多维度搜索，带进度回调
 */
async function performMultiSearch(
  entity: string,
  focus?: string[],
  onProgress?: (event: ProgressEvent) => void,
  previousGaps?: string[],
  isRetry: boolean = false
): Promise<FundDeepSearchData> {
  const startTime = Date.now();
  const sources: string[] = [];
  const MAX_SEARCH_QUERIES = 10;

  // 1. 生成优化查询
  const generatedQueries = generateOptimizedQueries(entity, focus, previousGaps, isRetry);
  const searchQueries = generatedQueries.slice(0, MAX_SEARCH_QUERIES);

  // 2. 发送规划事件
  onProgress?.({
    type: 'thinking',
    step: 1,
    message: `规划搜索策略: ${searchQueries.length} 个查询`,
    eventDetail: {
      eventType: 'thinking',
      label: '规划搜索策略',
      detail: isRetry
        ? `基于 ${previousGaps?.length || 0} 个信息缺口优化查询`
        : `生成 ${searchQueries.length} 个初始查询`,
      expandable: true,
      content: {
        queries: searchQueries,
        truncatedQueries: generatedQueries.length > MAX_SEARCH_QUERIES
          ? generatedQueries.slice(MAX_SEARCH_QUERIES)
          : [],
        gaps: previousGaps,
        optimized: isRetry
      },
      metadata: {
        queryCount: searchQueries.length,
        queryLimit: MAX_SEARCH_QUERIES,
        truncated: generatedQueries.length > MAX_SEARCH_QUERIES,
        gaps: previousGaps,
        isRetry
      }
    }
  });

  logger.info('Starting optimized multi-search', {
    entity,
    queries: searchQueries,
    gaps: previousGaps,
    isRetry
  });

  // 3. 逐个执行搜索并发送事件
  const allResults: any[] = [];

  for (let i = 0; i < searchQueries.length; i++) {
    const query = searchQueries[i];

    // 发送搜索开始事件
    onProgress?.({
      type: 'searching',
      step: i + 1,
      message: `搜索: ${query}`,
      eventDetail: {
        eventType: 'search',
        label: '网页搜索',
        detail: query,
        metadata: {
          query,
          tool: 'websearch',
          step: i + 1,
          totalSteps: searchQueries.length
        }
      }
    });

    try {
      // 执行搜索
      const searchStartTime = Date.now();
      const results = await smartSearch(query);
      const searchDuration = Date.now() - searchStartTime;

      // 收集结果
      const resultItems = results.results || [];
      allResults.push({
        query,
        results: resultItems,
        engine: results.engine,
        duration: searchDuration
      });

      // 收集来源
      resultItems.forEach((item: any) => {
        if (item.url && !sources.includes(item.url)) {
          sources.push(item.url);
        }
      });

      // 发送搜索结果事件
      onProgress?.({
        type: 'search_result',
        step: i + 1,
        message: `搜索完成: ${query} (${resultItems.length} 条结果)`,
        eventDetail: {
          eventType: 'search',
          label: '搜索结果',
          detail: `${query} · ${resultItems.length} 条结果`,
          expandable: true,
          content: resultItems.map((r: any) => ({
            title: r.title,
            snippet: r.description || r.snippet,
            url: r.url || r.link,
            source: r.source
          })),
          metadata: {
            query,
            resultCount: resultItems.length,
            durationMs: searchDuration,
            tool: results.engine || 'websearch'
          }
        }
      });

    } catch (error) {
      logger.warn('Search failed for query', { query, error: String(error) });

      onProgress?.({
        type: 'error',
        step: i + 1,
        message: `搜索失败: ${query}`,
        eventDetail: {
          eventType: 'search',
          label: '搜索失败',
          detail: `${query} - ${String(error)}`,
          metadata: {
            query,
            error: String(error)
          }
        }
      });
    }
  }

  // 4. 发送分析事件
  onProgress?.({
    type: 'analyzing',
    step: searchQueries.length + 1,
    message: '分析搜索结果...',
    eventDetail: {
      eventType: 'analyze',
      label: '分析数据',
      detail: `处理 ${allResults.length} 组搜索结果`,
      metadata: {
        resultGroups: allResults.length,
        totalSources: sources.length
      }
    }
  });

  // 5. 整理新闻
  const news: FundDeepSearchData['news'] = [];
  allResults.forEach((result: any) => {
    result.results?.slice(0, 3).forEach((item: any) => {
      const title = item.title || '';
      const desc = item.description || item.snippet || '';

      // 简单情感分析
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      const positiveWords = ['上涨', '增长', '利好', '优秀', '领先', '突破', '创新高'];
      const negativeWords = ['下跌', '亏损', '风险', '警示', '落后', '回撤', '暴跌'];

      const text = title + desc;
      if (positiveWords.some(w => text.includes(w))) sentiment = 'positive';
      else if (negativeWords.some(w => text.includes(w))) sentiment = 'negative';

      if (title && !news.some(n => n.title === title)) {
        news.push({
          title,
          source: item.url || item.link,
          sentiment,
          summary: desc?.substring(0, 150),
        });
      }
    });
  });

  // 6. 提取风险关键词
  const riskKeywords = ['风险', '亏损', '下跌', '回撤', '波动', '警示', '关注', '危机', '暴跌', '调整'];
  const risks: string[] = [];

  allResults.forEach((result: any) => {
    result.results?.forEach((item: any) => {
      const text = ((item.title || '') + ' ' + (item.description || item.snippet || '')).toLowerCase();
      riskKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          const snippet = item.description?.substring(0, 100) || item.title;
          if (snippet && !risks.some(r => snippet.includes(r) || r.includes(snippet))) {
            risks.push(snippet);
          }
        }
      });
    });
  });

  // 7. 尝试获取基金代码和详细信息
  const fundCodeMatch = entity.match(/(\d{6})/);
  const fundCode = fundCodeMatch ? fundCodeMatch[1] : undefined;

  let detailedInfo: any = {};
  if (fundCode) {
    try {
      onProgress?.({
        type: 'analyzing',
        step: searchQueries.length + 2,
        message: '获取详细基金信息...',
        eventDetail: {
          eventType: 'analyze',
          label: '深度分析',
          detail: `获取 ${fundCode} 的详细信息`,
          metadata: { fundCode }
        }
      });

      const webResult = await webAgent({
        task: 'fund_info',
        params: { fundCode, query: entity },
      });

      if (webResult.status === 'success') {
        detailedInfo = {
          rawSnippets: webResult.rawSnippets,
          summary: webResult.summary,
        };
      }
    } catch (error) {
      logger.warn('Failed to get detailed fund info', { error: String(error) });
    }
  }

  const duration = Date.now() - startTime;

  const data: FundDeepSearchData = {
    fundInfo: {
      name: entity,
      code: fundCode,
    },
    news: news.slice(0, 10),
    risks: risks.slice(0, 5),
    sources: sources.slice(0, 10),
    searchResults: allResults,
    searchQueries,
  };

  // 合并详细数据
  if (detailedInfo.summary) {
    data.fundInfo.type = detailedInfo.summary.includes('股票') ? '股票型' :
                         detailedInfo.summary.includes('债券') ? '债券型' :
                         detailedInfo.summary.includes('混合') ? '混合型' : '其他';
  }

  // 发送完成事件
  onProgress?.({
    type: 'search_complete',
    step: searchQueries.length + 3,
    message: `搜索完成: ${news.length} 条新闻, ${risks.length} 个风险信号`,
    eventDetail: {
      eventType: 'complete',
      label: '搜索完成',
      detail: `找到 ${news.length} 条新闻, ${risks.length} 个风险信号, ${sources.length} 个来源`,
      metadata: {
        durationMs: duration,
        newsCount: news.length,
        riskCount: risks.length,
        sourceCount: sources.length,
        queryCount: searchQueries.length
      }
    }
  });

  logger.info('Multi-search completed', {
    duration,
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

  async execute(input: SkillInput, onProgress?: (event: ProgressEvent) => void): Promise<SkillOutput> {
    const startTime = Date.now();
    const typedInput = input as FundDeepSearchInput;

    logger.info('Executing fund-deep-search', {
      entity: typedInput.entity,
      focus: typedInput.focus,
      depth: typedInput.depth,
      previousGaps: typedInput.previousGaps,
    });

    // 发送 skill 开始事件
    onProgress?.({
      type: 'skill_start',
      step: 1,
      message: `开始深度搜索: ${typedInput.entity}`,
      eventDetail: {
        eventType: 'skill_call',
        label: '深度搜索',
        detail: `分析对象: ${typedInput.entity}`,
        metadata: {
          entity: typedInput.entity,
          focus: typedInput.focus,
          hasPreviousGaps: !!typedInput.previousGaps?.length
        }
      }
    });

    try {
      // 执行搜索（传递 previousGaps 进行优化）
      const data = await performMultiSearch(
        typedInput.entity,
        typedInput.focus,
        onProgress,
        typedInput.previousGaps,
        typedInput.isRetry
      );

      // 计算置信度和缺口
      const confidence = calculateConfidence(data);
      const gaps = detectGaps(data);

      // 发送缺口检测事件（如果有）
      if (gaps.length > 0) {
        onProgress?.({
          type: 'gap_detected',
          step: 99,
          message: `检测到 ${gaps.length} 个信息缺口`,
          eventDetail: {
            eventType: 'analyze',
            label: '信息缺口分析',
            detail: `检测到 ${gaps.length} 个需要补充的信息`,
            expandable: true,
            content: gaps,
            metadata: {
              gapCount: gaps.length,
              gaps,
              confidence
            }
          }
        });
      }

      // 更新数据中的置信度
      data.confidence = confidence;
      data.gaps = gaps;

      const durationMs = Date.now() - startTime;

      // 生成建议
      const suggestions: string[] = [];
      if (gaps.includes('缺少最新财报数据')) {
        suggestions.push('建议补充搜索财报数据');
      }
      if (gaps.includes('缺少最新新闻动态')) {
        suggestions.push('建议扩大新闻搜索范围');
      }
      if (confidence > 0.6) {
        suggestions.push('数据充足，可以进入分析阶段');
      } else {
        suggestions.push(`建议继续补充信息（当前置信度 ${(confidence * 100).toFixed(0)}%）`);
      }

      // 发送 skill 完成事件
      onProgress?.({
        type: 'skill_complete',
        step: 100,
        message: `深度搜索完成: 置信度 ${(confidence * 100).toFixed(0)}%`,
        eventDetail: {
          eventType: 'complete',
          label: '搜索完成',
          detail: `置信度: ${(confidence * 100).toFixed(0)}%, 缺口: ${gaps.length} 个`,
          metadata: {
            durationMs,
            confidence,
            gapCount: gaps.length,
            newsCount: data.news.length,
            riskCount: data.risks.length
          }
        }
      });

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
        completeness: 1 - (gaps.length / 6),
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

      onProgress?.({
        type: 'error',
        step: 0,
        message: `搜索失败: ${String(error)}`,
        eventDetail: {
          eventType: 'search',
          label: '搜索失败',
          detail: String(error),
          metadata: { error: String(error) }
        }
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
