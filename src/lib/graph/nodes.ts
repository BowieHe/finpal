import { GraphState, ResearchSummary, ResearchSubTask, ResearchFinding, DataPoint, ProgressCallback } from './state';
import { getLLMInstance, withRetry, streamWithCallback } from '../llm/client';
import { smartSearch } from '../mcp/unified-search';
import { SearchEngine } from '@/types/mcp';
import { createLogger } from '../logger';
import { getPortfolioSummary, getHoldingDetail } from '../tools/portfolio';
import { compareFunds } from '../tools/comparison';
import { getFundRiskMetrics } from '../tools/risk';

const logger = createLogger('GraphNodes');

// ==================== 持仓意图识别 ====================

const PORTFOLIO_KEYWORDS = [
  '持仓', '我的基金', '我持有', '收益', '盈亏', '亏损', '投资组合',
  '建议', '分析', '风险', '表现', '怎么样', '对比', '比较', '回撤',
  '波动', '夏普', '定投', '赎回', '加仓', '减仓',
];

// 从问题中提取基金代码（6位数字）
function extractFundCodes(question: string): string[] {
  const matches = question.match(/\b\d{6}\b/g);
  return matches ? [...new Set(matches)] : [];
}

// 判断是否为持仓相关问题
function isPortfolioQuestion(question: string): boolean {
  return PORTFOLIO_KEYWORDS.some(kw => question.includes(kw));
}

// 调用持仓分析 Tools 并返回结构化上下文
async function fetchPortfolioContext(question: string, progressCallback?: ProgressCallback): Promise<string> {
  const sections: string[] = [];

  try {
    if (progressCallback) {
      progressCallback({
        type: 'node_start',
        data: { node: 'db_query', message: '正在加载您的持仓总览...' },
      });
    }
    // 始终获取持仓总览
    const summary = await getPortfolioSummary();
    if (summary.hasData) {
      if (progressCallback) {
        progressCallback({
          type: 'db_result',
          data: {
            results: [{
              type: '持仓总览',
              query: 'getPortfolioSummary()',
              status: 'success',
              results: [{
                title: '账户概况',
                description: `总投入: ${summary.totalCost} 元\n总市值: ${summary.totalValue} 元\n累计盈亏: ${summary.totalProfit} 元 (${summary.totalProfitRate}%)`
              }]
            }]
          }
        });
      }
      sections.push(`【持仓总览】
总投入：${summary.totalCost} 元
总市值：${summary.totalValue} 元
累计盈亏：${summary.totalProfit} 元（${summary.totalProfitRate}%）
今日盈亏：${summary.dailyProfit} 元
盈利基金数：${summary.profitCount} 只，亏损基金数：${summary.lossCount} 只
净值日期：${summary.navDate}

持仓明细：
${summary.holdings.map(h =>
        `  ${h.fundCode} ${h.fundName}：持有 ${h.shares} 份，成本 ${h.costPrice} 元，当前净值 ${h.currentNav} 元，市值 ${h.currentValue} 元，盈亏 ${h.totalProfit} 元（${h.profitRate}%），今日 ${h.dailyProfit} 元`
      ).join('\n')}`);

      // 如果问题涉及风险或全面分析，对每只基金获取风险指标
      const needsRiskAnalysis = ['风险', '波动', '回撤', '夏普', '建议', '分析', '全面'].some(k => question.includes(k));
      if (needsRiskAnalysis) {
        if (progressCallback) {
          progressCallback({
            type: 'node_start',
            data: { node: 'db_query', message: '正在计算每只基金的风险指标...' },
          });
        }
        for (const holding of summary.holdings) {
          try {
            const risk = await getFundRiskMetrics(holding.fundCode, '1y');
            if (progressCallback) {
              progressCallback({
                type: 'db_result',
                data: {
                  results: [{
                    type: '风险指标',
                    query: `getFundRiskMetrics(${holding.fundCode}, '1y')`,
                    status: !risk.insufficientData ? 'success' : 'warning',
                    results: [{ title: holding.fundName, description: !risk.insufficientData ? `年化: ${risk.annualReturn}%\n最大回撤: ${risk.maxDrawdown}%\n夏普比率: ${risk.sharpeRatio}\n风险等级: ${risk.riskLevel}` : '数据不足' }]
                  }]
                }
              });
            }
            if (!risk.insufficientData) {
              sections.push(`【${risk.fundCode} ${risk.fundName} 风险指标（近1年）】
年化收益率：${risk.annualReturn ?? 'N/A'}%
年化波动率：${risk.volatility ?? 'N/A'}%
最大回撤：${risk.maxDrawdown ?? 'N/A'}%
夏普比率：${risk.sharpeRatio ?? 'N/A'}
风险等级：${risk.riskLevel}（${risk.riskReason}）`);
            }
          } catch (e) {
            logger.warn('Risk metrics fetch failed', { fundCode: holding.fundCode, error: String(e) });
          }
        }
      }
    } else {
      sections.push('【持仓状态】目前没有持仓记录，无法进行持仓分析。');
    }

    // 如果问题包含基金代码，获取对比分析
    const fundCodes = extractFundCodes(question);
    if (fundCodes.length > 0) {
      if (progressCallback) {
        progressCallback({
          type: 'node_start',
          data: { node: 'db_query', message: `正在横向对比基金: ${fundCodes.join(', ')}...` },
        });
      }
      try {
        const comparison = await compareFunds(fundCodes);
        if (progressCallback) {
          progressCallback({
            type: 'db_result',
            data: {
              results: [{
                type: '横向对比',
                query: `compareFunds([${fundCodes.join(', ')}])`,
                status: 'success',
                results: comparison.funds.map(f => ({
                  title: f.fundName,
                  description: `近1年收益: ${f.return1y ?? 'N/A'}%\n近6月收益: ${f.return6m ?? 'N/A'}%\n最大回撤: ${f.maxDrawdown ?? 'N/A'}%`
                }))
              }]
            }
          });
        }
        sections.push(`【基金对比分析】
${comparison.funds.map(f =>
          `${f.fundCode} ${f.fundName}（${f.category ?? '未知'}）：
  近1月 ${f.return1m ?? 'N/A'}%，近3月 ${f.return3m ?? 'N/A'}%，近6月 ${f.return6m ?? 'N/A'}%，近1年 ${f.return1y ?? 'N/A'}%
  波动率 ${f.volatility ?? 'N/A'}%，最大回撤 ${f.maxDrawdown ?? 'N/A'}%
  ${'isHolding' in f && f.isHolding ? '（已持有）' : '（未持有）'}`
        ).join('\n\n')}`);
      } catch (e) {
        logger.warn('Fund comparison fetch failed', { fundCodes, error: String(e) });
      }
    }
  } catch (e) {
    logger.error('Portfolio context fetch failed', { error: String(e) });
    sections.push('【持仓数据获取失败】无法连接数据库，请稍后重试。');
  }

  return sections.join('\n\n');
}

// ==================== 工具函数 ====================

export function getContentString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(c => {
      if (typeof c === 'string') return c;
      if (typeof c === 'object' && c !== null && 'text' in c) return String((c as { text: string }).text);
      return '';
    }).join('');
  }
  if (typeof content === 'object' && content !== null && 'text' in content) {
    return String((content as { text: string }).text);
  }
  return '';
}

export function extractJSONFromText(text: string): Record<string, unknown> | null {
  // 1. Try simple parse
  try {
    return JSON.parse(text);
  } catch { /* ignore */ }

  // 2. Try markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch { /* ignore */ }
  }

  // 3. Try to find the last occurrence of { ... } which is common for our hybrid approach
  const lastJsonMatch = text.match(/\{[\s\S]*\}/g);
  if (lastJsonMatch) {
    const lastMatch = lastJsonMatch[lastJsonMatch.length - 1];
    try {
      return JSON.parse(lastMatch);
    } catch { /* ignore */ }
  }

  return null;
}

async function safeJsonParse(response: { content: unknown }): Promise<Record<string, unknown>> {
  const contentStr = getContentString(response.content);
  logger.info('safeJsonParse input', { contentLength: contentStr.length, contentPreview: contentStr.substring(0, 500) });
  const result = extractJSONFromText(contentStr);
  if (result) {
    logger.info('safeJsonParse success', { resultKeys: Object.keys(result) });
    return result;
  }
  logger.error('safeJsonParse failed', { contentLength: contentStr.length, fullContent: contentStr });
  throw new Error(`Failed to parse LLM response as JSON: ${contentStr.substring(0, 200)}...`);
}

function getCurrentDateInfo(): { date: string; year: number; month: number; day: number } {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function extractYearFromQuestion(question: string): number | null {
  const yearPatterns = [/(\d{4})年/g, /(\d{4})/g];
  const years: number[] = [];
  for (const pattern of yearPatterns) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      const year = parseInt(match[1], 10);
      if (year >= 2020 && year <= 2030) years.push(year);
    }
  }
  return years.length > 0 ? Math.max(...years) : null;
}

function buildSearchQueryPrompt(question: string): string {
  const dateInfo = getCurrentDateInfo();
  const userSpecifiedYear = extractYearFromQuestion(question);
  return `你是信息收集专家。当前日期：${dateInfo.date}。

用户问题：${question}

请分析这个问题，并生成 2-3 个有效的搜索查询。
重要提示：
- 当前年份是 ${dateInfo.year} 年
- 如果用户询问的是最新/最近/当前的信息，请使用 ${dateInfo.year} 年作为时间范围
- 如果用户在问题中明确指定了年份（如"2023年"），则使用用户指定的年份: ${userSpecifiedYear || '未指定'}
- 避免使用过时的年份（如2023、2024），除非用户明确要求
- 对于投资、市场、新闻类问题，优先搜索最新信息

请严格以 JSON 格式返回（不要有其他文字）：
{"search_queries": ["查询1", "查询2"], "reasoning": "推理过程"}`;
}

// ==================== 类型定义 ====================

interface SearchAnalysis {
  search_queries: string[];
  reasoning: string;
}

interface PersonaOutput {
  thinking: string;
  answer: string;
  // EV 计算相关字段
  probability?: any;
  payoff?: any;
  catalysts?: any[];
  keyRisks?: string[];
  confidenceLevel?: number;
  // 悲观派特有字段
  riskFactors?: any[];
  catalystsForDecline?: string[];
}

interface DeciderOutput {
  should_continue: boolean;
  reason: string;
  winner: 'optimistic' | 'pessimistic' | 'draw';
  final_verdict: FinalVerdict;
}

export interface FinalVerdict {
  summary: string;             // 一句话结论
  recommendation: "strong_buy" | "hold" | "reduce" | "avoid" | "info_only";
  confidence: number;          // 0-100，数据越完整置信度越高
  bullPoints: string[];        // 乐观观点（≤3条）
  bearPoints: string[];        // 悲观观点（≤3条）
  comparisonTable?: {          // 若涉及多只基金对比，输出结构化对比表
    fundCode: string;
    sharpe: number;
    mdd: number;
    recommendation: string;
  }[];
  riskWarnings: string[];      // 风险提示（含 Gate Keeper 传入的 warning）
  sources: string[];           // 数据来源 URL
}

// ==================== 常量配置 ====================

const MAX_SEARCH_RESULTS_LENGTH = 4000;
const DEFAULT_FALLBACK_ANSWER = {
  optimistic: '乐观派分析暂时不可用，请稍后重试。',
  pessimistic: '悲观派分析暂时不可用，请稍后重试。',
};

// ==================== 核心节点函数 ====================

export const researcherNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting researcher node', { question: state.question });

  const llm = await getLLMInstance();

  // ---- Step 0: 持仓意图识别 + Tool 调用 ----
  let portfolioContext = '';
  if (isPortfolioQuestion(state.question)) {
    logger.info('Portfolio question detected, fetching holding data from DB');
    if (state.progressCallback) {
      state.progressCallback({
        type: 'analyzing',
        data: { message: '您的问题涉及您的投资组合，正在启动本地数据库分析引擎...' },
      });
    }
    portfolioContext = await fetchPortfolioContext(state.question, state.progressCallback);
    logger.info('Portfolio context fetched', { contextLength: portfolioContext.length });

    if (state.progressCallback) {
      state.progressCallback({
        type: 'analyzing',
        data: { message: '持仓数据获取完成，开始综合分析...' },
      });
    }
  }

  const analysisPrompt = buildSearchQueryPrompt(state.question);

  // 1. 生成搜索查询分析
  let analysis: SearchAnalysis;
  try {
    const analysisResponse = await withRetry(() => llm.invoke(analysisPrompt), 2, 1000);
    const parsed = await safeJsonParse(analysisResponse);
    analysis = {
      search_queries: Array.isArray(parsed.search_queries)
        ? (parsed.search_queries as string[])
        : [state.question],
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (error) {
    logger.error('Analysis failed, using fallback', { error: error instanceof Error ? error.message : String(error) });
    analysis = {
      search_queries: [state.question],
      reasoning: 'LLM 解析失败，使用原始问题作为查询',
    };
  }

  logger.info('Generated search queries', { queries: analysis.search_queries, reasoning: analysis.reasoning });

  // 2. 执行搜索
  const searchResults = [];
  const totalQueries = analysis.search_queries.length;

  for (let i = 0; i < analysis.search_queries.length; i++) {
    const query = analysis.search_queries[i];

    if (state.progressCallback) {
      state.progressCallback({
        type: 'searching',
        data: {
          currentQuery: query,
          currentIndex: i + 1,
          totalQueries,
          progress: Math.round(((i + 1) / totalQueries) * 100),
        },
      });
    }

    try {
      const result = await smartSearch(query);
      searchResults.push(result);

      if (state.progressCallback) {
        state.progressCallback({
          type: 'search_result',
          data: {
            query: query,
            results: result.results.slice(0, 5).map(r => ({
              title: r.title,
              snippet: r.description?.substring(0, 200),
              url: r.url,
            })),
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      logger.error('Search failed for query', { query, error: error instanceof Error ? error.message : String(error) });
      searchResults.push({
        query,
        engine: 'error' as SearchEngine,
        results: [],
        timestamp: Date.now(),
        reasoning: `搜索失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // 3. 统计搜索引擎使用情况
  const engineUsage = searchResults.reduce((acc, r) => {
    if (r.engine !== 'error') {
      acc[r.engine] = (acc[r.engine] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  logger.info('Search engine usage', engineUsage);

  // 发送搜索完成事件
  if (state.progressCallback) {
    state.progressCallback({
      type: 'search_complete',
      data: {
        searchCount: searchResults.length,
        engineUsage,
      },
    });
  }

  // 4. 生成研究总结（支持流式关键事实）
  let summary: ResearchSummary = {
    key_facts: [],
    data_points: [],
    summary: '搜索完成',
  };

  try {
    const searchResultsText = JSON.stringify(searchResults, null, 2);
    const truncatedResults = searchResultsText.length > MAX_SEARCH_RESULTS_LENGTH
      ? searchResultsText.substring(0, MAX_SEARCH_RESULTS_LENGTH) + '\n... (truncated)'
      : searchResultsText;

    // 如果有持仓数据，优先注入到 summary prompt
    const portfolioSection = portfolioContext
      ? `\n\n【用户真实持仓数据（来自数据库，高可信度）】\n${portfolioContext}\n\n`
      : '';

    const summaryPrompt = `${portfolioSection}以下是搜索结果：\n\n${truncatedResults}\n\n请总结关键事实。严格以 JSON 格式返回：\n{"key_facts": ["事实1"], "data_points": [{"source": "来源", "value": "数值", "context": "上下文"}], "summary": "总结"}`;

    if (state.progressCallback) {
      state.progressCallback({
        type: 'analyzing',
        data: {
          keyFactsCount: 0,
          message: '正在生成研究总结...',
        },
      });
    }

    // 使用流式调用生成研究总结
    let streamedContent = '';
    let jsonStarted = false;
    let currentKeyFacts: string[] = [];

    const fullResponse = await streamWithCallback(
      summaryPrompt,
      (chunk) => {
        streamedContent += chunk;

        if (!jsonStarted && streamedContent.includes('```json')) {
          jsonStarted = true;
          return;
        }

        if (jsonStarted) return;
        
        // Optional: Send research thinking to UI? 
        // For now, let's just filter it and if we want it in UI, we'd add it to progressCallback
        try {
          const match = streamedContent.match(/"key_facts"\s*:\s*\[([^\]]*)\]/);
          if (match) {
            const factsText = match[1];
            const factMatches = factsText.match(/"([^"]*)"/g);
            if (factMatches && factMatches.length > currentKeyFacts.length) {
              currentKeyFacts = factMatches.map(f => f.replace(/"/g, ''));
              if (state.progressCallback && currentKeyFacts.length > 0) {
                state.progressCallback({
                  type: 'research_summary_stream',
                  data: {
                    keyFacts: currentKeyFacts,
                    partial: true,
                  },
                });
              }
            }
          }
        } catch {
          // 解析失败时忽略
        }
      },
      2
    );

    const parsed = await safeJsonParse({ content: fullResponse });
    summary = {
      key_facts: Array.isArray(parsed.key_facts) ? (parsed.key_facts as string[]) : [],
      data_points: Array.isArray(parsed.data_points)
        ? (parsed.data_points as Array<{ source: string; value: string; context: string }>)
        : [],
      summary: String(parsed.summary || "搜索完成"),
    };

    if (state.progressCallback) {
      state.progressCallback({
        type: "research_summary",
        data: {
          keyFacts: summary.key_facts,
          dataPoints: summary.data_points,
          summary: summary.summary,
        },
      });
    }
  } catch (error) {
    logger.error("Summary failed", { error: error instanceof Error ? error.message : String(error) });
    summary.summary = `搜索完成，但总结失败: ${error instanceof Error ? error.message : "Unknown error"}`;
  }

  const duration = Date.now() - startTime;
  logger.info('Researcher node completed', {
    duration,
    searchCount: searchResults.length,
    keyFactsCount: summary.key_facts.length,
    dataPointsCount: summary.data_points.length,
  });

  return {
    searchResults,
    researchSummary: summary,
    engineUsage,
  };
};


// ==================== 其他节点函数 ====================

export const optimisticInitialNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting optimistic initial node');

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'optimistic', message: '乐观派开始分析...' },
    });
  }

  const llm = await getLLMInstance();
  const researchSummary = state.researchSummary;
  const researchContext = researchSummary
    ? `关键事实：\n${researchSummary.key_facts.join('\n')}\n\n总结：${researchSummary.summary}`
    : '暂无研究总结';

  const prompt = `你是乐观派分析师（Bull Analyst）。你的任务是基于研究信息，从做多/看好的角度分析，并给出概率化的投资判断。

【分析原则】
1. 你代表的是"看多"立场，但必须基于事实 and 逻辑，而非盲目乐观
2. 你需要给出具体的概率数字，而不是模糊的"看好"
3. 考虑风险收益比，识别 Catalyst（催化剂）

【用户问题】
${state.question}

【研究信息】
${researchContext}

【补充数据 (来自底层 Agent)】
${Object.keys(state.collectedData || {}).length > 0 ? JSON.stringify(state.collectedData, null, 2) : '无'}

【输出要求】
请直接开始你的分析（内容包含“思考过程”和“最终建议”两个部分，使用 Markdown 标题），最后在一个独立的 Markdown JSON 代码块中返回结构化数据。
结构如下：

## 思考过程
(你的详细思考过程...)

## 最终建议
(给用户的简洁建议...)

\`\`\`json
{
  "thinking": "...",
  "answer": "...",
  "probability": { ... },
  "payoff": { ... },
  "catalysts": [ ... ],
  "keyRisks": [ ... ],
  "confidenceLevel": 75
}
\`\`\`
`;

  try {
    // 使用流式调用
    let streamedContent = '';
    let jsonStarted = false;

    const fullResponse = await streamWithCallback(
      prompt,
      (chunk) => {
        streamedContent += chunk;

        // 拦截 JSON 块不发给 UI
        if (!jsonStarted && streamedContent.includes('```json')) {
          jsonStarted = true;
          const cleanChunk = chunk.split('```json')[0];
          if (cleanChunk && state.progressCallback) {
            state.progressCallback({
              type: 'stream_chunk',
              data: { node: 'optimistic', chunk: cleanChunk },
            });
          }
          return;
        }

        if (jsonStarted) return;

        if (state.progressCallback) {
          state.progressCallback({
            type: 'stream_chunk',
            data: {
              node: 'optimistic',
              chunk: chunk,
            },
          });
        }
      },
      2,
      llm
    );

    // 解析最终结果
    const parsed = extractJSONFromText(fullResponse);
    if (!parsed) {
      throw new Error('Failed to parse optimistic response');
    }

    const result: PersonaOutput = {
      thinking: String(parsed.thinking || ''),
      answer: String(parsed.answer || ''),
      probability: parsed.probability || null,
      payoff: parsed.payoff || null,
      catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts : [],
      keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [],
      confidenceLevel: Number(parsed.confidenceLevel) || 50,
    };

    // 发送最终输出事件（供展示图标/详细数据，如果前端有监听）
    if (state.progressCallback) {
      state.progressCallback({
        type: 'optimistic_output',
        data: { ...result },
      });
    }

    logger.info('Optimistic initial node completed', { duration: Date.now() - startTime });
    return {
      optimisticThinking: result.thinking,
      optimisticAnswer: result.answer,
      optimisticData: {
        probability: result.probability || { baseRate: 50, adjustedRate: 50, adjustmentReason: '默认' },
        payoff: result.payoff || { upsidePotential: 10, downsideRisk: -10, timeframe: '未知', expectedReturn: 0 },
        catalysts: result.catalysts || [],
        keyRisks: result.keyRisks || [],
        confidenceLevel: result.confidenceLevel || 50,
      },
    };
  } catch (error) {
    logger.error('Optimistic initial node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      optimisticThinking: '分析过程出错',
      optimisticAnswer: DEFAULT_FALLBACK_ANSWER.optimistic,
      optimisticData: null,
    };
  }
};

export const pessimisticInitialNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting pessimistic initial node');

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'pessimistic', message: '悲观派开始分析...' },
    });
  }

  const llm = await getLLMInstance();
  const researchSummary = state.researchSummary;
  const researchContext = researchSummary
    ? `关键事实：\n${researchSummary.key_facts.join('\n')}\n\n总结：${researchSummary.summary}`
    : '暂无研究总结';

  const prompt = `你是悲观派分析师（Bear Analyst）。你的任务是基于研究信息，从做空/谨慎的角度分析，并给出概率化的风险提示。

【分析原则】
1. 你代表的是"看空/谨慎"立场，但必须基于事实 and 逻辑，而非单纯悲观
2. 你需要给出具体的概率数字，而不是模糊的"不看好"
3. 识别潜在下行风险、估值泡沫、宏观逆风

【用户问题】
${state.question}

【研究信息】
${researchContext}

【补充数据 (来自底层 Agent)】
${Object.keys(state.collectedData || {}).length > 0 ? JSON.stringify(state.collectedData, null, 2) : '无'}

【输出要求】
请直接开始你的分析（内容包含“思考过程”和“最终建议”两个部分，使用 Markdown 标题），最后在一个独立的 Markdown JSON 代码块中返回结构化数据。
结构如下：

## 思考过程
(你的详细思考过程...)

## 最终建议
(给用户的简洁建议...)

\`\`\`json
{
  "thinking": "...",
  "answer": "...",
  "probability": { ... },
  "payoff": { ... },
  "riskFactors": [ ... ],
  "catalystsForDecline": [ ... ],
  "confidenceLevel": 70
}
\`\`\`
`;

  try {
    let streamedContent = '';
    let jsonStarted = false;

    const fullResponse = await streamWithCallback(
      prompt,
      (chunk) => {
        streamedContent += chunk;

        if (!jsonStarted && streamedContent.includes('```json')) {
          jsonStarted = true;
          const cleanChunk = chunk.split('```json')[0];
          if (cleanChunk && state.progressCallback) {
            state.progressCallback({
              type: 'stream_chunk',
              data: { node: 'pessimistic', chunk: cleanChunk },
            });
          }
          return;
        }

        if (jsonStarted) return;

        if (state.progressCallback) {
          state.progressCallback({
            type: 'stream_chunk',
            data: {
              node: 'pessimistic',
              chunk: chunk,
            },
          });
        }
      },
      2,
      llm
    );

    const parsed = extractJSONFromText(fullResponse);
    if (!parsed) {
      throw new Error('Failed to parse pessimistic response');
    }

    const result: PersonaOutput = {
      thinking: String(parsed.thinking || ''),
      answer: String(parsed.answer || ''),
      probability: parsed.probability || null,
      payoff: parsed.payoff || null,
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      catalystsForDecline: Array.isArray(parsed.catalystsForDecline) ? parsed.catalystsForDecline : [],
      confidenceLevel: Number(parsed.confidenceLevel) || 50,
    };

    if (state.progressCallback) {
      state.progressCallback({
        type: 'pessimistic_output',
        data: { ...result },
      });
    }

    logger.info('Pessimistic initial node completed', { duration: Date.now() - startTime });
    return {
      pessimisticThinking: result.thinking,
      pessimisticAnswer: result.answer,
      pessimisticData: {
        probability: result.probability || { downsideProbability: 50, severity: 'medium', timeline: '未知' },
        payoff: result.payoff || { upsideCap: 10, downsideRisk: -10, timeframe: '未知', expectedReturn: 0 },
        riskFactors: result.riskFactors || [],
        catalystsForDecline: result.catalystsForDecline || [],
        confidenceLevel: result.confidenceLevel || 50,
      },
    };
  } catch (error) {
    logger.error('Pessimistic initial node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      pessimisticThinking: '分析过程出错',
      pessimisticAnswer: DEFAULT_FALLBACK_ANSWER.pessimistic,
      pessimisticData: null,
    };
  }
};

export const optimisticRebuttalNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting optimistic rebuttal node');

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'optimistic_rebuttal', message: '乐观派正在反驳...' },
    });
  }

  const llm = await getLLMInstance();
  const prompt = `你是乐观派分析师。现在进入反驳阶段。

## 原问题
${state.question}

## 你的初始观点
${state.optimisticAnswer}

## 悲观派观点
${state.pessimisticAnswer}

请针对悲观派的观点进行反驳，强化你的立场。

【输出要求】
请流式输出你的反驳过程，最后在一个独立的 Markdown JSON 代码块中返回：
\`\`\`json
{"rebuttal": "你的最终反驳内容"}
\`\`\`
`;

  try {
    let streamedContent = '';
    let jsonStarted = false;
    const fullResponse = await streamWithCallback(
      prompt,
      (chunk) => {
        streamedContent += chunk;
        if (!jsonStarted && streamedContent.includes('```json')) {
          jsonStarted = true;
          return;
        }
        if (jsonStarted) return;

        if (state.progressCallback) {
          state.progressCallback({
            type: 'stream_chunk',
            data: { node: 'optimistic_rebuttal', chunk },
          });
        }
      },
      2,
      llm
    );

    const parsed = extractJSONFromText(fullResponse);
    if (!parsed) throw new Error('Failed to parse optimistic rebuttal response');

    const rebuttal = String(parsed.rebuttal || '');
    if (state.progressCallback) {
      state.progressCallback({
        type: 'optimistic_rebuttal',
        data: { rebuttal },
      });
    }

    return { optimisticRebuttal: rebuttal };
  } catch (error) {
    logger.error('Optimistic rebuttal node failed', { error: String(error) });
    return { optimisticRebuttal: '反驳过程出错' };
  }
};

export const pessimisticRebuttalNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting pessimistic rebuttal node');

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'pessimistic_rebuttal', message: '悲观派正在反驳...' },
    });
  }

  const llm = await getLLMInstance();
  const prompt = `你是悲观派分析师。现在进入反驳阶段。

## 原问题
${state.question}

## 你的初始观点
${state.pessimisticAnswer}

## 乐观派观点
${state.optimisticAnswer}

## 乐观派反驳
${state.optimisticRebuttal}

请针对乐观派的观点和反驳进行再反驳，强化你的立场。

【输出要求】
请流式输出你的反驳过程，最后在一个独立的 Markdown JSON 代码块中返回：
\`\`\`json
{"rebuttal": "你的最终反驳内容"}
\`\`\`
`;

  try {
    let streamedContent = '';
    let jsonStarted = false;
    const fullResponse = await streamWithCallback(
      prompt,
      (chunk) => {
        streamedContent += chunk;
        if (!jsonStarted && streamedContent.includes('```json')) {
          jsonStarted = true;
          return;
        }
        if (jsonStarted) return;

        if (state.progressCallback) {
          state.progressCallback({
            type: 'stream_chunk',
            data: { node: 'pessimistic_rebuttal', chunk },
          });
        }
      },
      2,
      llm
    );

    const parsed = extractJSONFromText(fullResponse);
    if (!parsed) throw new Error('Failed to parse pessimistic rebuttal response');

    const rebuttal = String(parsed.rebuttal || '');
    if (state.progressCallback) {
      state.progressCallback({
        type: 'pessimistic_rebuttal',
        data: { rebuttal },
      });
    }

    return { pessimisticRebuttal: rebuttal };
  } catch (error) {
    logger.error('Pessimistic rebuttal node failed', { error: String(error) });
    return { pessimisticRebuttal: '反驳过程出错' };
  }
};

// ==================== Round Judge Node ====================

export const roundJudgeNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  const currentRound = state.round + 1;
  logger.info('Starting round judge node', { round: currentRound });

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'round_judge', message: `第 ${currentRound} 轮 裁决中...` },
    });
  }

  const latestOptimistic = state.optimisticRebuttal || state.optimisticAnswer;
  const latestPessimistic = state.pessimisticRebuttal || state.pessimisticAnswer;

  const prompt = `你是公正的轮次裁判员。请基于本轮辩论内容做出裁判。

## 轮次
Round ${currentRound}

## 双方论点
乐观派：${latestOptimistic.substring(0, 600)}
悲观派：${latestPessimistic.substring(0, 600)}

【输出要求】
请输出裁判思考，最后在一个独立的 Markdown JSON 代码块中返回：
\`\`\`json
{"winner": "optimistic|pessimistic|draw", "should_continue": true/false, "reason": "理由"}
\`\`\`
`;

  try {
    let streamedContent = '';
    let jsonStarted = false;
    const fullResponse = await streamWithCallback(
      prompt,
      (chunk) => {
        streamedContent += chunk;
        if (!jsonStarted && streamedContent.includes('```json')) {
          jsonStarted = true;
          return;
        }
        if (jsonStarted) return;

        if (state.progressCallback) {
          state.progressCallback({
            type: 'stream_chunk',
            data: { node: 'round_judge', chunk },
          });
        }
      },
      2
    );

    const parsed = extractJSONFromText(fullResponse);
    const winner = (parsed?.winner as any) || 'draw';
    const shouldContinue = Boolean(parsed?.should_continue);
    const reason = String(parsed?.reason || '');

    if (state.progressCallback) {
      state.progressCallback({
        type: 'round_judge',
        data: { round: currentRound, winner, shouldContinue, reason, node: 'round_judge' },
      });
    }

    return { debateWinner: winner, shouldContinue, round: currentRound };
  } catch (error) {
    logger.error('Round judge failed', { error: String(error) });
    return { debateWinner: 'draw', shouldContinue: false, round: currentRound };
  }
};

// ==================== Final Verdict Node ====================

export const finalVerdictNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting decider node');

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'decider', message: '正在生成最终裁决报告...' },
    });
  }

  const collectedDataObj = state.collectedData || {};
  let dataContext = '';
  for (const [key, result] of Object.entries(collectedDataObj)) {
    dataContext += `\n--- 数据 ${key} ---\n${JSON.stringify(result, null, 2)}`;
  }

  const prompt = `你是首席投资官。请生成最终裁决报告。

## 问题
${state.question}

## 数据
${dataContext || '暂无数据'}

## 辩论记录
乐观派最终立场：${state.optimisticRebuttal || state.optimisticAnswer}
悲观派最终立场：${state.pessimisticRebuttal || state.pessimisticAnswer}

【输出要求】
请直接流式输出你的详细报告内容（Markdown 格式），最后在一个独立的 Markdown JSON 代码块中返回结构化数据：
\`\`\`json
{
  "winner": "...",
  "should_continue": false,
  "reason": "...",
  "final_verdict": {
    "summary": "...",
    "recommendation": "...",
    "confidence": 85,
    "bullPoints": [...],
    "bearPoints": [...],
    "riskWarnings": [...],
    "sources": [...]
  }
}
\`\`\`
`;

  try {
    let streamedContent = '';
    let jsonStarted = false;
    const fullResponse = await streamWithCallback(
      prompt,
      (chunk) => {
        streamedContent += chunk;
        if (!jsonStarted && streamedContent.includes('```json')) {
          jsonStarted = true;
          return;
        }
        if (jsonStarted) return;

        if (state.progressCallback) {
          state.progressCallback({
            type: 'stream_chunk',
            data: { node: 'decider', chunk },
          });
        }
      },
      2
    );

    const parsed = extractJSONFromText(fullResponse);
    if (!parsed) throw new Error('Failed to parse decider response');

    const result: DeciderOutput = {
      winner: (parsed.winner as any) || 'draw',
      should_continue: Boolean(parsed.should_continue),
      reason: String(parsed.reason || ''),
      final_verdict: parsed.final_verdict as FinalVerdict,
    };

    if (state.progressCallback) {
      state.progressCallback({
        type: 'final_verdict',
        data: result.final_verdict as any,
      });
      state.progressCallback({
        type: 'node_start',
        data: { node: 'decider_complete', message: '裁决完成', winner: result.winner },
      });
    }

    return {
      debateWinner: result.winner,
      debateSummary: JSON.stringify(result.final_verdict),
      shouldContinue: result.should_continue,
      round: state.round + 1,
    };
  } catch (error) {
    logger.error('Decider node failed', { error: String(error) });
    return { debateWinner: 'draw', debateSummary: '裁决过程出错', shouldContinue: false, round: state.round + 1 };
  }
};

// ==================== Deep Research 节点 ====================

export const plannerNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting planner node', { question: state.question });

  const llm = await getLLMInstance();
  const prompt = `你是研究规划专家。请为以下问题制定研究计划。

问题：${state.question}

请生成 ${state.breadth} 个搜索查询来全面研究这个问题。以JSON格式返回：{"queries": ["查询1", "查询2", "查询3"], "reasoning": "规划理由"}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const queries = Array.isArray(parsed.queries) ? (parsed.queries as string[]) : [state.question];

    const subTasks: ResearchSubTask[] = queries.map((query, index) => ({
      id: `task-${index}`,
      query,
      depth: 0,
      status: 'pending',
    }));

    logger.info('Planner node completed', { duration: Date.now() - startTime, taskCount: subTasks.length });
    return {
      subTasks,
      researchPlan: queries,
      currentDepth: 0,
    };
  } catch (error) {
    logger.error('Planner node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      subTasks: [{
        id: 'task-0',
        query: state.question,
        depth: 0,
        status: 'pending',
      }],
      researchPlan: [state.question],
      currentDepth: 0,
    };
  }
};

export const parallelResearchNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting parallel research node', { taskCount: state.subTasks.length });

  const pendingTasks = state.subTasks.filter(t => t.status === 'pending');
  const findings: ResearchFinding[] = [];
  const totalTasks = pendingTasks.length;

  if (state.progressCallback && totalTasks > 0) {
    state.progressCallback({
      type: 'searching',
      data: { currentQuery: pendingTasks[0].query, currentIndex: 1, totalQueries: totalTasks, progress: 0 },
    });
  }

  await Promise.all(
    pendingTasks.map(async (task, index) => {
      try {
        task.status = 'researching';
        if (state.progressCallback) {
          state.progressCallback({
            type: 'searching',
            data: {
              currentQuery: task.query,
              currentIndex: index + 1,
              totalQueries: totalTasks,
              progress: Math.round(((index) / totalTasks) * 100),
            },
          });
        }

        const result = await smartSearch(task.query);
        task.status = 'completed';
        task.result = JSON.stringify(result.results);
        task.sources = result.results.map(r => r.url).filter(Boolean) as string[];

        findings.push({
          query: task.query,
          content: JSON.stringify(result.results),
          depth: task.depth,
          sources: task.sources || [],
        });

        if (state.progressCallback) {
          state.progressCallback({
            type: 'search_result',
            data: {
              query: task.query,
              results: result.results.slice(0, 5).map(r => ({
                title: r.title,
                snippet: r.description?.substring(0, 200),
                url: r.url,
              })),
            },
          });
        }
      } catch (error) {
        task.status = 'failed';
        logger.error('Research task failed', { query: task.query, error: String(error) });
      }
    })
  );

  const allFindings = [...state.allFindings, ...findings];

  if (state.progressCallback) {
    state.progressCallback({
      type: 'search_complete',
      data: { searchCount: findings.length, totalTasks },
    });
    state.progressCallback({
      type: 'analyzing',
      data: { message: '正在分析研究发现...', keyFactsCount: 0 },
    });
  }

  const llm = await getLLMInstance();
  const findingsText = allFindings.map(f => `查询：${f.query}\n结果：${f.content.substring(0, 500)}`).join('\n\n');
  const summaryPrompt = `针对研究发现，生成关键事实和总结。

结果：
${findingsText}

请流式输出你的分析过程（Markdown），最后在一个独立的 Markdown JSON 代码块中返回：
\`\`\`json
{"key_facts": ["事实1"], "data_points": [{"source": "来源", "value": "数值", "context": "上下文"}], "summary": "总结"}
\`\`\`
`;

  let researchSummary: ResearchSummary = { key_facts: [], data_points: [], summary: '研究完成' };

  try {
    let streamedContent = '';
    const fullResponse = await streamWithCallback(
      summaryPrompt,
      (chunk) => {
        streamedContent += chunk;
        // 这里不需要拦截，因为研究总结是内部流
      },
      2
    );

    const parsed = await safeJsonParse({ content: fullResponse });
    researchSummary = {
      key_facts: Array.isArray(parsed.key_facts) ? (parsed.key_facts as string[]) : [],
      data_points: Array.isArray(parsed.data_points) ? (parsed.data_points as DataPoint[]) : [],
      summary: String(parsed.summary || '研究完成'),
    };

    if (state.progressCallback) {
      state.progressCallback({
        type: 'research_summary',
        data: { ...researchSummary },
      });
    }
  } catch (error) {
    logger.error('Summary generation failed', { error: String(error) });
  }

  return { subTasks: state.subTasks, allFindings, researchSummary, currentDepth: state.currentDepth + 1 };
};

export const deepCheckNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  if (state.currentDepth >= state.maxDepth) return { shouldContinue: false };

  logger.info('Starting deep search reflection check');

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'reflector', message: '正在评估研究深度并规划下一路径...' },
    });
  }

  const findingsSummary = state.allFindings.map(f => `查询：${f.query}\n内容摘要：${f.content.substring(0, 300)}`).join('\n\n');
  const prompt = `你是研究评估专家。判断当前研究是否充分，是否需要进一步下钻。
  
原问题：${state.question}

当前研究发现：
${findingsSummary}

【输出要求】
请直接开始你的评估思考（为什么充分或为什么需要继续），最后在一个独立的 Markdown JSON 代码块中返回结构化数据。
结构如下：
\`\`\`json
{
  "sufficient": true/false,
  "reason": "你的简短总结理由",
  "additional_queries": ["如果需要继续，提供1-3个新的深度搜索词"]
}
\`\`\`
`;

  try {
    let streamedContent = '';
    let jsonStarted = false;
    const fullResponse = await streamWithCallback(
      prompt,
      (chunk) => {
        streamedContent += chunk;
        if (!jsonStarted && streamedContent.includes('```json')) {
          jsonStarted = true;
          return;
        }
        if (jsonStarted) return;

        if (state.progressCallback) {
          state.progressCallback({
            type: 'stream_chunk',
            data: { node: 'reflector', chunk, depth: state.currentDepth },
          });
        }
      },
      2
    );

    const parsed = extractJSONFromText(fullResponse);
    if (!parsed) throw new Error('Failed to parse deep check response');

    const sufficient = Boolean(parsed.sufficient);
    const reason = String(parsed.reason || '');

    if (state.progressCallback) {
      state.progressCallback({
        type: 'agent_done',
        data: { agentId: 'reflector', summary: reason, node: 'reflector' }
      });
    }

    if (!sufficient && Array.isArray(parsed.additional_queries)) {
      const newTasks: ResearchSubTask[] = parsed.additional_queries.map((query: string, index: number) => ({
        id: `task-${state.currentDepth + 1}-${index}`, // 使用 nextDepth 的任务 ID
        query,
        depth: state.currentDepth + 1,
        status: 'pending',
      }));
      
      logger.info('Deep check determined more research needed', { newTasksCount: newTasks.length });
      return { 
        subTasks: newTasks, // 这里返回单次循环的新任务，reducer 会自动 concat
        shouldContinue: true,
        round: state.round // 保持 round 不变，由 judge 控制 round
      };
    }

    logger.info('Deep check determined research is sufficient');
    return { shouldContinue: false };
  } catch (error) {
    logger.error('Deep check failed', { error: String(error) });
    return { shouldContinue: false };
  }
};
