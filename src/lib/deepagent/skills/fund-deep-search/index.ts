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
const MAX_SEARCH_QUERIES = 10;

type ResearchEntityKind = 'fund' | 'index' | 'asset';

type ResearchBoard = NonNullable<FundDeepSearchData['researchBoard']>;
type SearchResultGroup = {
  query: string;
  results: any[];
  engine: string;
  duration: number;
};
type CriticReview = {
  accepted: boolean;
  reason: string;
  informationDelta: number;
  coveredGaps: Array<{
    gap: string;
    evidence: string[];
    confidence: number;
  }>;
  acceptedResults: any[];
  rejectedResults: Array<{
    title: string;
    reason: string;
    url?: string;
  }>;
};

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
function classifyResearchEntity(data: Pick<FundDeepSearchData, 'fundInfo'>): ResearchEntityKind {
  const name = `${data.fundInfo.name || ''} ${data.fundInfo.type || ''}`.toLowerCase();
  const code = data.fundInfo.code || '';

  if (/\d{6}/.test(code) || /基金|etf|lof|fof/.test(name)) {
    return 'fund';
  }

  if (/指数|index|沪深|上证|深证|中证|恒生|纳斯达克|标普|日经|道琼斯/.test(name)) {
    return 'index';
  }

  return 'asset';
}

function calculateConfidence(data: FundDeepSearchData): number {
  const entityKind = classifyResearchEntity(data);
  let score = 0;

  // 基础信息 (最高 0.3)
  if (data.fundInfo.name) score += 0.15;
  if (data.fundInfo.code) score += 0.1;
  if (data.fundInfo.type) score += 0.05;

  // 基础面 / 价格数据 (最高 0.25)
  if (entityKind === 'fund') {
    if (data.financials?.latestReport) score += 0.15;
    if (data.financials?.revenue || data.financials?.profit) score += 0.1;
    if (data.fundInfo.aum || data.fundInfo.nav) score += 0.05;
    if (data.fundInfo.manager) score += 0.05;
  } else {
    const hasMarketCoverage = data.searchQueries.some((query) => /价格|走势|收益|历史数据|市场表现/.test(query));
    if (hasMarketCoverage) score += 0.15;
    if (data.news.length >= 3) score += 0.1;
  }

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
  const entityKind = classifyResearchEntity(data);
  const gaps: string[] = [];

  if (entityKind === 'fund' && !data.financials?.latestReport) {
    gaps.push('缺少最新财报数据');
  }

  if (data.news.length === 0) {
    gaps.push('缺少最新新闻动态');
  } else if (data.news.length < 3) {
    gaps.push('新闻数量较少');
  }

  if (entityKind === 'fund' && !data.fundInfo.aum && !data.fundInfo.nav) {
    gaps.push('缺少基金规模/净值信息');
  }

  if (data.risks.length === 0) {
    gaps.push('未识别风险因素');
  }

  if (entityKind === 'fund' && !data.fundInfo.manager) {
    gaps.push('缺少基金经理信息');
  }

  if (entityKind !== 'fund') {
    const hasMarketCoverage = data.searchQueries.some((query) => /价格|走势|收益|历史数据|市场表现/.test(query));
    if (!hasMarketCoverage) {
      gaps.push('缺少价格走势与市场表现数据');
    }
  }

  return gaps;
}

function createResearchProposal(entity: string, focus?: string[]): ResearchBoard['proposal'] {
  const isFund = /\d{6}/.test(entity);
  const subQuestions = [
    isFund ? '基金基础信息是否完整' : '资产当前价格与趋势如何',
    '近期市场新闻和催化因素有哪些',
    '主要风险信号是什么',
  ];

  if (!focus || focus.includes('financial')) {
    subQuestions.push(isFund ? '最新财报和净值表现如何' : '收益表现和宏观驱动如何');
  }
  if (isFund && (!focus || focus.includes('manager'))) {
    subQuestions.push('基金经理与管理人背景如何');
  }
  if (!focus || focus.includes('competitor')) {
    subQuestions.push('是否存在可比较的竞品或替代资产');
  }

  return {
    mainQuestion: `围绕 ${entity} 构建投资研究底稿`,
    subQuestions,
    priorityOrder: [...subQuestions],
  };
}

function initializeResearchBoard(
  entity: string,
  focus?: string[],
  previousGaps?: string[]
): ResearchBoard {
  return {
    proposal: createResearchProposal(entity, focus),
    knownFacts: [],
    informationGaps: previousGaps?.length
      ? [...previousGaps]
      : ['最新新闻动态', '风险信号', '基础信息完整性'],
    hypotheses: [],
    searchedQueries: [],
    failedPaths: [],
    coveredGaps: [],
  };
}

function recordKnownFacts(board: ResearchBoard, resultGroups: SearchResultGroup[]) {
  for (const group of resultGroups) {
    const topResults = group.results.slice(0, 2);
    for (const item of topResults) {
      const title = item.title || '';
      const source = item.url || item.link || '';
      if (!title || !source) continue;
      if (board.knownFacts.some(fact => fact.claim === title && fact.source === source)) continue;

      board.knownFacts.push({
        claim: title,
        source,
        confidence: item.description ? 0.65 : 0.5,
      });
    }
  }
}

function refreshInformationGaps(board: ResearchBoard, data: FundDeepSearchData) {
  const detected = detectGaps(data);
  board.informationGaps = detected;

  for (const fact of board.knownFacts) {
    if (!fact.gapCovered) {
      if (fact.claim.includes('风险') || fact.claim.includes('下跌')) {
        fact.gapCovered = '风险信号';
      } else if (fact.claim.includes('基金') || fact.claim.includes('ETF')) {
        fact.gapCovered = '基础信息完整性';
      } else if (fact.claim.includes('业绩') || fact.claim.includes('财报')) {
        fact.gapCovered = '财报与业绩';
      } else if (fact.claim.includes('新闻') || fact.claim.includes('价格')) {
        fact.gapCovered = '最新新闻动态';
      }
    }
  }
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

function deriveHypotheses(
  entity: string,
  queries: string[],
  gaps: string[] | undefined,
  isRetry: boolean
): ResearchBoard['hypotheses'] {
  const effectiveGaps = gaps?.length ? gaps : ['基础面', '新闻动态', '风险信号'];

  return effectiveGaps.map((gap, index) => ({
    gap,
    rationale: isRetry
      ? `上一轮仍存在“${gap}”缺口，因此收窄搜索策略并更换关键词路径`
      : `先验证“${gap}”是否能通过公开网页信息补齐`,
    targetSources: gap.includes('财报')
      ? ['基金公告', '公司财报', '交易所披露']
      : gap.includes('经理')
        ? ['基金公司官网', '公开简历', '第三方基金资料页']
        : ['新闻站点', '研究文章', '行情页'],
    queryPatterns: queries.slice(index, index + 2),
  }));
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isNearDuplicateQuery(query: string, searchedQueries: string[]): boolean {
  const normalized = normalizeQuery(query);
  return searchedQueries.some(prev => {
    const normalizedPrev = normalizeQuery(prev);
    return normalizedPrev === normalized
      || normalized.includes(normalizedPrev)
      || normalizedPrev.includes(normalized);
  });
}

function decideStopReason(
  board: ResearchBoard,
  queryCount: number,
  gaps: string[],
  confidence: number
): string {
  if (gaps.length === 0) {
    return '核心信息缺口已补齐，搜索可以优雅结束';
  }
  if (confidence >= 0.7) {
    return `当前置信度 ${(confidence * 100).toFixed(0)}% 已足够进入分析阶段`;
  }
  if (queryCount >= MAX_SEARCH_QUERIES) {
    return `已达到网络搜索上限 ${MAX_SEARCH_QUERIES} 次，避免无效重复搜索`;
  }
  if (board.failedPaths.length >= Math.max(3, Math.ceil(queryCount / 2))) {
    return '连续出现低价值或失败路径，建议切换到辩论或数据库上下文';
  }
  return '保留部分信息缺口，交由后续技能继续补齐';
}

function evaluateSearchResults(
  query: string,
  resultItems: any[],
  board: ResearchBoard
): CriticReview {
  const seenTitles = new Set(
    board.knownFacts.map(fact => normalizeQuery(fact.claim))
  );
  const seenUrls = new Set(
    board.knownFacts.map(fact => fact.source).filter(Boolean)
  );

  const acceptedResults: any[] = [];
  const rejectedResults: CriticReview['rejectedResults'] = [];
  const coveredGapsMap = new Map<string, { gap: string; evidence: string[]; confidence: number }>();

  for (const item of resultItems) {
    const title = item.title || '搜索结果';
    const url = item.url || item.link || '';
    const snippet = item.description || item.snippet || '';
    const normalizedTitle = normalizeQuery(title);

    if (!snippet || snippet.length < 20) {
      rejectedResults.push({ title, url, reason: 'snippet_too_short' });
      continue;
    }
    if (seenTitles.has(normalizedTitle)) {
      rejectedResults.push({ title, url, reason: 'duplicate_title' });
      continue;
    }
    if (url && seenUrls.has(url)) {
      rejectedResults.push({ title, url, reason: 'duplicate_url' });
      continue;
    }
    if (/广告|推广|开户链接|开户链接|开户链接|下载App|开户链接/i.test(`${title} ${snippet}`)) {
      rejectedResults.push({ title, url, reason: 'promotional_content' });
      continue;
    }

    const gapSignals = [
      {
        gap: '缺少最新财报数据',
        test: /财报|业绩|营收|利润|季报|年报|净值/i,
      },
      {
        gap: '缺少最新新闻动态',
        test: /新闻|快讯|动态|消息|走势|价格|行情/i,
      },
      {
        gap: '未识别风险因素',
        test: /风险|回撤|波动|下跌|警示|危机/i,
      },
      {
        gap: '缺少基金经理信息',
        test: /基金经理|经理|掌舵|投资总监/i,
      },
      {
        gap: '缺少基金规模\/净值信息',
        test: /规模|资产规模|aum|净值|份额/i,
      },
    ];

    for (const signal of gapSignals) {
      if (signal.test.test(`${title} ${snippet}`)) {
        const existing = coveredGapsMap.get(signal.gap);
        if (existing) {
          if (existing.evidence.length < 3) {
            existing.evidence.push(title);
          }
          existing.confidence = Math.max(existing.confidence, 0.6);
        } else {
          coveredGapsMap.set(signal.gap, {
            gap: signal.gap,
            evidence: [title],
            confidence: snippet.length > 80 ? 0.8 : 0.6,
          });
        }
      }
    }

    seenTitles.add(normalizedTitle);
    if (url) seenUrls.add(url);
    acceptedResults.push(item);
  }

  const informationDelta = resultItems.length === 0
    ? 0
    : acceptedResults.length / resultItems.length;

  return {
    accepted: acceptedResults.length > 0,
    reason: acceptedResults.length > 0
      ? `保留 ${acceptedResults.length} 条高价值结果，过滤 ${rejectedResults.length} 条低价值或重复结果`
      : `查询“${query}”未提供有效信息增量`,
    informationDelta,
    coveredGaps: Array.from(coveredGapsMap.values()),
    acceptedResults,
    rejectedResults,
  };
}

function mergeCoveredGaps(board: ResearchBoard, query: string, review: CriticReview) {
  for (const item of review.coveredGaps) {
    const existing = board.coveredGaps?.find(entry => entry.gap === item.gap);
    if (existing) {
      existing.evidence = Array.from(new Set([...existing.evidence, ...item.evidence])).slice(0, 4);
      existing.confidence = Math.max(existing.confidence, item.confidence);
      existing.query = existing.query || query;
    } else {
      board.coveredGaps?.push({
        gap: item.gap,
        query,
        evidence: item.evidence.slice(0, 3),
        confidence: item.confidence,
      });
    }
  }
}

function shouldStopEarly(
  board: ResearchBoard,
  allResults: SearchResultGroup[],
  currentIndex: number,
  totalQueries: number
): string | null {
  const acceptedGroups = allResults.filter(group => group.results.length > 0);
  const hasCoveredNews = acceptedGroups.some(group => /新闻|动态|消息/.test(group.query));
  const hasCoveredRisk = acceptedGroups.some(group => /风险|回撤|波动|警示/.test(group.query));
  const hasCoveredFundamentals = acceptedGroups.some(group => /财报|业绩|价格|走势|净值/.test(group.query));
  const remainingQueries = totalQueries - currentIndex - 1;

  if (hasCoveredNews && hasCoveredRisk && hasCoveredFundamentals && acceptedGroups.length >= 3) {
    return '核心维度已有覆盖，提前结束剩余搜索轮次';
  }

  if ((board.coveredGaps?.length || 0) >= 3 && acceptedGroups.length >= 2) {
    return '关键缺口已有明显覆盖，提前结束并进入分析阶段';
  }

  if (board.failedPaths.length >= 4 && remainingQueries <= 2) {
    return '失败路径过多且剩余查询有限，提前停止避免继续烧搜索';
  }

  return null;
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
  const researchBoard = initializeResearchBoard(entity, focus, previousGaps);

  // 1. 生成优化查询
  const generatedQueries = generateOptimizedQueries(entity, focus, previousGaps, isRetry);
  const dedupedQueries = generatedQueries.filter(query => !isNearDuplicateQuery(query, researchBoard.searchedQueries));
  const searchQueries = dedupedQueries.slice(0, MAX_SEARCH_QUERIES);
  researchBoard.hypotheses = deriveHypotheses(entity, searchQueries, previousGaps, isRetry);

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
        proposal: researchBoard.proposal,
        hypotheses: researchBoard.hypotheses,
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

  onProgress?.({
    type: 'thinking',
    step: 1,
    message: `研究大纲已建立: ${researchBoard.proposal.subQuestions.length} 个子问题`,
    eventDetail: {
      eventType: 'thinking',
      label: 'Research Proposal',
      detail: researchBoard.proposal.mainQuestion,
      expandable: true,
      content: researchBoard.proposal,
      metadata: {
        subQuestionCount: researchBoard.proposal.subQuestions.length,
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
    if (isNearDuplicateQuery(query, researchBoard.searchedQueries)) {
      researchBoard.failedPaths.push({
        query,
        reason: 'query_duplicate',
      });

      onProgress?.({
        type: 'thinking',
        step: i + 1,
        message: `跳过重复搜索: ${query}`,
        eventDetail: {
          eventType: 'thinking',
          label: '跳过重复路径',
          detail: query,
          metadata: {
            query,
            reason: 'query_duplicate',
          }
        }
      });
      continue;
    }
    researchBoard.searchedQueries.push(query);

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
      const review = evaluateSearchResults(query, resultItems, researchBoard);
      const filteredItems = review.acceptedResults;

      if (!review.accepted || results.error) {
        researchBoard.failedPaths.push({
          query,
          reason: resultItems.length === 0
            ? 'no_results'
            : results.error
              ? 'search_error'
              : review.reason,
        });
      }
      allResults.push({
        query,
        results: filteredItems,
        engine: results.engine,
        duration: searchDuration
      });
      mergeCoveredGaps(researchBoard, query, review);

      // 收集来源
      filteredItems.forEach((item: any) => {
        if (item.url && !sources.includes(item.url)) {
          sources.push(item.url);
        }
      });

      // 发送搜索结果事件
      onProgress?.({
        type: 'search_result',
        step: i + 1,
        message: `搜索完成: ${query} (${resultItems.length} 条结果)`,
        data: {
          query,
          results: filteredItems.map((r: any) => ({
            title: r.title,
            snippet: r.description || r.snippet,
            url: r.url || r.link,
            source: r.source,
          })),
          review,
        },
        eventDetail: {
          eventType: 'search',
          label: '搜索结果',
          detail: `${query} · 原始 ${resultItems.length} 条 / 保留 ${filteredItems.length} 条`,
          expandable: true,
          content: filteredItems.map((r: any) => ({
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

      onProgress?.({
        type: 'analyzing',
        step: i + 1,
        message: `评估搜索价值: ${query}`,
        data: {
          query,
          review,
        },
        eventDetail: {
          eventType: 'analyze',
          label: 'Critic Review',
          detail: review.reason,
          expandable: true,
          content: {
            query,
            informationDelta: review.informationDelta,
            coveredGaps: review.coveredGaps,
            acceptedResults: review.acceptedResults.map(item => ({
              title: item.title,
              url: item.url || item.link,
            })),
            rejectedResults: review.rejectedResults,
          },
          metadata: {
            query,
            informationDelta: review.informationDelta,
            coveredGapCount: review.coveredGaps.length,
            keptCount: review.acceptedResults.length,
            rejectedCount: review.rejectedResults.length,
          }
        }
      });

      const earlyStopReason = shouldStopEarly(researchBoard, allResults, i, searchQueries.length);
      if (earlyStopReason) {
        researchBoard.stopReason = earlyStopReason;
        onProgress?.({
          type: 'thinking',
          step: i + 1,
          message: '触发动态停止条件',
          data: {
            stopReason: earlyStopReason,
          },
          eventDetail: {
            eventType: 'thinking',
            label: 'Dynamic Stop',
            detail: earlyStopReason,
            metadata: {
              searchedQueries: researchBoard.searchedQueries.length,
              failedPathCount: researchBoard.failedPaths.length,
            }
          }
        });
        break;
      }

    } catch (error) {
      logger.warn('Search failed for query', { query, error: String(error) });
      researchBoard.failedPaths.push({
        query,
        reason: String(error),
      });

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
    researchBoard,
  };

  // 合并详细数据
  if (detailedInfo.summary) {
    data.fundInfo.type = detailedInfo.summary.includes('股票') ? '股票型' :
                         detailedInfo.summary.includes('债券') ? '债券型' :
                         detailedInfo.summary.includes('混合') ? '混合型' : '其他';
  }

  recordKnownFacts(researchBoard, allResults);
  refreshInformationGaps(researchBoard, data);

  // 发送完成事件
  onProgress?.({
    type: 'search_complete',
    step: searchQueries.length + 3,
    message: `搜索完成: ${news.length} 条新闻, ${risks.length} 个风险信号`,
    data: {
      searchResults: allResults,
      researchBoard,
      summary: {
        newsCount: news.length,
        riskCount: risks.length,
        sourceCount: sources.length,
      },
    },
    eventDetail: {
      eventType: 'complete',
      label: '搜索完成',
      detail: `找到 ${news.length} 条新闻, ${risks.length} 个风险信号, ${sources.length} 个来源`,
      expandable: true,
      content: {
        knownFacts: researchBoard.knownFacts.slice(0, 8),
        informationGaps: researchBoard.informationGaps,
        coveredGaps: researchBoard.coveredGaps,
        failedPaths: researchBoard.failedPaths,
      },
      metadata: {
        durationMs: duration,
        newsCount: news.length,
        riskCount: risks.length,
        sourceCount: sources.length,
        queryCount: searchQueries.length,
        failedPathCount: researchBoard.failedPaths.length,
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
      if (data.researchBoard) {
        data.researchBoard.stopReason = decideStopReason(data.researchBoard, data.searchQueries.length, gaps, confidence);
      }

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
      if (data.researchBoard?.stopReason) {
        suggestions.push(data.researchBoard.stopReason);
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
          expandable: true,
          content: data.researchBoard,
          metadata: {
            durationMs,
            confidence,
            gapCount: gaps.length,
            newsCount: data.news.length,
            riskCount: data.risks.length,
            stopReason: data.researchBoard?.stopReason,
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
