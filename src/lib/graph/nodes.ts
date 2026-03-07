import { GraphState, ResearchSummary, ResearchSubTask, ResearchFinding, DataPoint } from './state';
import { getLLMInstance, withRetry, streamWithCallback } from '../llm/client';
import { smartSearch } from '../mcp/unified-search';
import { SearchEngine } from '@/types/mcp';
import { createLogger } from '../logger';

const logger = createLogger('GraphNodes');

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
  try {
    return JSON.parse(text);
  } catch {
    // ignore
  }

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      logger.error('Failed to parse JSON from text', { textPreview: text.substring(0, 100) });
    }
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
}

interface DeciderOutput {
  should_continue: boolean;
  reason: string;
  winner: 'optimistic' | 'pessimistic' | 'draw';
  summary: string;
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

  const llm = getLLMInstance();
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

    const summaryPrompt = `以下是搜索结果：\n\n${truncatedResults}\n\n请总结关键事实。严格以 JSON 格式返回：\n{"key_facts": ["事实1"], "data_points": [{"source": "来源", "value": "数值", "context": "上下文"}], "summary": "总结"}`;

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
    let currentKeyFacts: string[] = [];
    
    const fullResponse = await streamWithCallback(
      summaryPrompt,
      (chunk) => {
        streamedContent += chunk;
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
      summary: String(parsed.summary || '搜索完成'),
    };

    if (state.progressCallback) {
      state.progressCallback({
        type: 'research_summary',
        data: {
          keyFacts: summary.key_facts,
          dataPoints: summary.data_points,
          summary: summary.summary,
        },
      });
    }
  } catch (error) {
    logger.error('Summary failed', { error: error instanceof Error ? error.message : String(error) });
    summary.summary = `搜索完成，但总结失败: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
      data: { node: 'optimistic' },
    });
  }

  const llm = getLLMInstance();
  const researchSummary = state.researchSummary;
  const researchContext = researchSummary
    ? `关键事实：\n${researchSummary.key_facts.join('\n')}\n\n总结：${researchSummary.summary}`
    : '暂无研究总结';

  const prompt = `你是乐观派分析师。请基于以下研究信息，从乐观角度分析问题。\n\n问题：${state.question}\n\n研究信息：\n${researchContext}\n\n请提供你的思考过程和最终答案。以JSON格式返回：{"thinking": "思考过程", "answer": "最终答案"}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const result: PersonaOutput = {
      thinking: String(parsed.thinking || ''),
      answer: String(parsed.answer || ''),
    };

    if (state.progressCallback) {
      state.progressCallback({
        type: 'optimistic_output',
        data: { thinking: result.thinking, answer: result.answer },
      });
    }

    logger.info('Optimistic initial node completed', { duration: Date.now() - startTime });
    return {
      optimisticThinking: result.thinking,
      optimisticAnswer: result.answer,
    };
  } catch (error) {
    logger.error('Optimistic initial node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      optimisticThinking: '分析过程出错',
      optimisticAnswer: DEFAULT_FALLBACK_ANSWER.optimistic,
    };
  }
};

export const pessimisticInitialNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting pessimistic initial node');

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'pessimistic' },
    });
  }

  const llm = getLLMInstance();
  const researchSummary = state.researchSummary;
  const researchContext = researchSummary
    ? `关键事实：\n${researchSummary.key_facts.join('\n')}\n\n总结：${researchSummary.summary}`
    : '暂无研究总结';

  const prompt = `你是悲观派分析师。请基于以下研究信息，从悲观/谨慎角度分析问题。\n\n问题：${state.question}\n\n研究信息：\n${researchContext}\n\n请提供你的思考过程和最终答案。以JSON格式返回：{"thinking": "思考过程", "answer": "最终答案"}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const result: PersonaOutput = {
      thinking: String(parsed.thinking || ''),
      answer: String(parsed.answer || ''),
    };

    if (state.progressCallback) {
      state.progressCallback({
        type: 'pessimistic_output',
        data: { thinking: result.thinking, answer: result.answer },
      });
    }

    logger.info('Pessimistic initial node completed', { duration: Date.now() - startTime });
    return {
      pessimisticThinking: result.thinking,
      pessimisticAnswer: result.answer,
    };
  } catch (error) {
    logger.error('Pessimistic initial node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      pessimisticThinking: '分析过程出错',
      pessimisticAnswer: DEFAULT_FALLBACK_ANSWER.pessimistic,
    };
  }
};

export const optimisticRebuttalNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting optimistic rebuttal node');

  const llm = getLLMInstance();
  const prompt = `你是乐观派分析师。现在进入反驳阶段。\n\n原问题：${state.question}\n\n你的初始观点：${state.optimisticAnswer}\n\n悲观派观点：${state.pessimisticAnswer}\n\n请针对悲观派的观点进行反驳，强化你的立场。以JSON格式返回：{"rebuttal": "反驳内容"}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const rebuttal = String(parsed.rebuttal || '');

    if (state.progressCallback) {
      state.progressCallback({
        type: 'optimistic_rebuttal',
        data: { rebuttal },
      });
    }

    logger.info('Optimistic rebuttal node completed', { duration: Date.now() - startTime });
    return { optimisticRebuttal: rebuttal };
  } catch (error) {
    logger.error('Optimistic rebuttal node failed', { error: error instanceof Error ? error.message : String(error) });
    return { optimisticRebuttal: '反驳过程出错' };
  }
};

export const pessimisticRebuttalNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting pessimistic rebuttal node');

  const llm = getLLMInstance();
  const prompt = `你是悲观派分析师。现在进入反驳阶段。\n\n原问题：${state.question}\n\n你的初始观点：${state.pessimisticAnswer}\n\n乐观派观点：${state.optimisticAnswer}\n\n乐观派反驳：${state.optimisticRebuttal}\n\n请针对乐观派的观点和反驳进行再反驳，强化你的立场。以JSON格式返回：{"rebuttal": "反驳内容"}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const rebuttal = String(parsed.rebuttal || '');

    if (state.progressCallback) {
      state.progressCallback({
        type: 'pessimistic_rebuttal',
        data: { rebuttal },
      });
    }

    logger.info('Pessimistic rebuttal node completed', { duration: Date.now() - startTime });
    return { pessimisticRebuttal: rebuttal };
  } catch (error) {
    logger.error('Pessimistic rebuttal node failed', { error: error instanceof Error ? error.message : String(error) });
    return { pessimisticRebuttal: '反驳过程出错' };
  }
};

export const deciderNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting decider node');

  const llm = getLLMInstance();
  const prompt = `你是公正的裁决者。请基于以下辩论内容做出最终裁决。\n\n原问题：${state.question}\n\n乐观派观点：${state.optimisticAnswer}\n\n乐观派反驳：${state.optimisticRebuttal}\n\n悲观派观点：${state.pessimisticAnswer}\n\n悲观派反驳：${state.pessimisticRebuttal}\n\n请裁决：\n1. 哪方观点更有说服力？（optimistic/pessimistic/draw）\n2. 是否继续辩论？（true/false）\n3. 裁决理由\n4. 辩论总结\n\n以JSON格式返回：{"winner": "optimistic|pessimistic|draw", "should_continue": false, "reason": "理由", "summary": "总结"}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const result: DeciderOutput = {
      winner: (parsed.winner as 'optimistic' | 'pessimistic' | 'draw') || 'draw',
      should_continue: Boolean(parsed.should_continue),
      reason: String(parsed.reason || ''),
      summary: String(parsed.summary || ''),
    };

    logger.info('Decider node completed', { duration: Date.now() - startTime, winner: result.winner });
    return {
      debateWinner: result.winner,
      debateSummary: result.summary,
      shouldContinue: result.should_continue,
      round: state.round + 1,
    };
  } catch (error) {
    logger.error('Decider node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      debateWinner: 'draw',
      debateSummary: '裁决过程出错',
      shouldContinue: false,
      round: state.round + 1,
    };
  }
};

// ==================== Deep Research 节点 ====================

export const plannerNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting planner node', { question: state.question });

  const llm = getLLMInstance();
  const prompt = `你是研究规划专家。请为以下问题制定研究计划。\n\n问题：${state.question}\n\n请生成 ${state.breadth} 个搜索查询来全面研究这个问题。以JSON格式返回：{"queries": ["查询1", "查询2", "查询3"], "reasoning": "规划理由"}`;

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

  // 发送开始搜索的进度事件
  if (state.progressCallback && totalTasks > 0) {
    state.progressCallback({
      type: 'searching',
      data: {
        currentQuery: pendingTasks[0].query,
        currentIndex: 1,
        totalQueries: totalTasks,
        progress: 0,
      },
    });
  }

  await Promise.all(
    pendingTasks.map(async (task, index) => {
      try {
        // 更新任务状态
        task.status = 'researching';

        // 发送搜索进度事件
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

        // 任务完成
        task.status = 'completed';
        task.result = JSON.stringify(result.results);
        task.sources = result.results.map(r => r.url).filter(Boolean) as string[];

        findings.push({
          query: task.query,
          content: JSON.stringify(result.results),
          depth: task.depth,
          sources: task.sources || [],
        });

        // 发送搜索结果事件
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

        // 更新搜索进度
        if (state.progressCallback) {
          state.progressCallback({
            type: 'searching',
            data: {
              currentQuery: task.query,
              currentIndex: index + 1,
              totalQueries: totalTasks,
              progress: Math.round(((index + 1) / totalTasks) * 100),
            },
          });
        }
      } catch (error) {
        task.status = 'failed';
        logger.error('Research task failed', { query: task.query, error: error instanceof Error ? error.message : String(error) });
      }
    })
  );

  const allFindings = [...state.allFindings, ...findings];

  // 发送分析中事件
  if (state.progressCallback) {
    state.progressCallback({
      type: 'analyzing',
      data: {
        message: '正在分析研究发现...',
        keyFactsCount: 0,
      },
    });
  }

  // 生成研究总结（支持流式关键事实）
  const llm = getLLMInstance();
  const findingsText = allFindings.map(f => `查询：${f.query}\n结果：${f.content.substring(0, 500)}`).join('\n\n');
  const summaryPrompt = `基于以下研究发现，生成关键事实和总结。\n\n${findingsText}\n\n以JSON格式返回：{"key_facts": ["事实1", "事实2"], "data_points": [{"source": "来源", "value": "数值", "context": "上下文"}], "summary": "总结"}`;

  let researchSummary: ResearchSummary = {
    key_facts: [],
    data_points: [],
    summary: '研究完成',
  };

  try {
    // 使用流式调用生成研究总结
    let streamedContent = '';
    let currentKeyFacts: string[] = [];

    const fullResponse = await streamWithCallback(
      summaryPrompt,
      (chunk) => {
        streamedContent += chunk;
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
    researchSummary = {
      key_facts: Array.isArray(parsed.key_facts) ? (parsed.key_facts as string[]) : [],
      data_points: Array.isArray(parsed.data_points) ? (parsed.data_points as DataPoint[]) : [],
      summary: String(parsed.summary || '研究完成'),
    };

    // 发送最终研究总结
    if (state.progressCallback) {
      state.progressCallback({
        type: 'research_summary',
        data: {
          keyFacts: researchSummary.key_facts,
          dataPoints: researchSummary.data_points,
          summary: researchSummary.summary,
        },
      });
    }
  } catch (error) {
    logger.error('Summary generation failed', { error: error instanceof Error ? error.message : String(error) });
  }

  logger.info('Parallel research node completed', { duration: Date.now() - startTime, findingCount: findings.length });
  return {
    subTasks: state.subTasks,
    allFindings,
    researchSummary,
    currentDepth: state.currentDepth + 1,
  };
};

export const deepCheckNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting deep check node', { currentDepth: state.currentDepth, maxDepth: state.maxDepth });

  // 检查是否达到最大深度
  if (state.currentDepth >= state.maxDepth) {
    logger.info('Max depth reached, completing research');
    return { shouldContinue: false };
  }

  const llm = getLLMInstance();
  const findingsSummary = state.allFindings.map(f => `查询：${f.query}\n内容摘要：${f.content.substring(0, 300)}`).join('\n\n');
  const prompt = `你是研究质量评估专家。请评估当前研究是否充分回答问题。\n\n原问题：${state.question}\n\n当前研究发现：\n${findingsSummary}\n\n请判断：\n1. 研究是否充分？（true/false）\n2. 如不充分，还需要研究哪些方面？\n3. 理由\n\n以JSON格式返回：{"sufficient": true/false, "additional_queries": ["查询1"], "reason": "理由"}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const sufficient = Boolean(parsed.sufficient);

    // 如果需要更多研究，添加新任务
    if (!sufficient && Array.isArray(parsed.additional_queries)) {
      const newQueries = parsed.additional_queries as string[];
      const newTasks: ResearchSubTask[] = newQueries.map((query, index) => ({
        id: `task-${state.currentDepth}-${index}`,
        query,
        depth: state.currentDepth,
        status: 'pending',
      }));

      logger.info('Deep check: more research needed', { newTaskCount: newTasks.length });
      return {
        subTasks: [...state.subTasks, ...newTasks],
        shouldContinue: true,
      };
    }

    logger.info('Deep check: research sufficient', { duration: Date.now() - startTime });
    return { shouldContinue: false };
  } catch (error) {
    logger.error('Deep check failed', { error: error instanceof Error ? error.message : String(error) });
    return { shouldContinue: false };
  }
};