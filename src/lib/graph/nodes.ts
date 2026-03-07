import { GraphState, ResearchSummary, ResearchSubTask, ResearchFinding, DataPoint } from './state';
import { getLLMInstance, withRetry } from '../llm/client';
import { smartSearch, batchSearch } from '../mcp/unified-search';
import { SearchEngine } from '@/types/mcp';
import { createLogger } from '../logger';

const logger = createLogger('GraphNodes');

/**
 * 安全的 JSON 解析
 * 处理 LLM 可能返回的 markdown 代码块包裹的 JSON
 */
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

/**
 * 从文本中提取 JSON
 * 处理 LLM 返回的非标准格式（如 markdown 代码块）
 */
export function extractJSONFromText(text: string): Record<string, unknown> | null {
  // 首先尝试直接解析
  try {
    return JSON.parse(text);
  } catch {
    // 忽略直接解析失败
  }

  // 尝试从 markdown 代码块中提取
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // 继续尝试其他方法
    }
  }

  // 尝试从文本中提取第一个 JSON 对象
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
/**
 * 安全解析 LLM 响应
 */
async function safeJsonParse(response: { content: unknown }): Promise<Record<string, unknown>> {
  const contentStr = getContentString(response.content);
  
  logger.info('safeJsonParse input', { 
    contentLength: contentStr.length,
    contentPreview: contentStr.substring(0, 500)
  });

  const result = extractJSONFromText(contentStr);
  if (result) {
    logger.info('safeJsonParse success', { resultKeys: Object.keys(result) });
    return result;
  }

  logger.error('safeJsonParse failed', { 
    contentLength: contentStr.length,
    fullContent: contentStr 
  });
  throw new Error(`Failed to parse LLM response as JSON: ${contentStr.substring(0, 200)}...`);
}

/**
 * 获取当前日期信息
 * 用于让 LLM 知道当前时间，生成更准确的搜索查询
 */
function getCurrentDateInfo(): { date: string; year: number; month: number; day: number } {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0], // YYYY-MM-DD
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

/**
 * 从用户问题中提取年份
 * 如果用户明确指定了年份，则使用该年份
 */
function extractYearFromQuestion(question: string): number | null {
  // 匹配常见的年份格式：2023年、2024、2025
  const yearPatterns = [
    /(\d{4})年/g,
    /(\d{4})/g,
  ];
  
  const years: number[] = [];
  for (const pattern of yearPatterns) {
    const matches = question.matchAll(pattern);
    for (const match of matches) {
      const year = parseInt(match[1], 10);
      // 只接受合理的年份（2020-2030）
      if (year >= 2020 && year <= 2030) {
        years.push(year);
      }
    }
  }
  
  // 返回用户明确提到的最新年份
  return years.length > 0 ? Math.max(...years) : null;
}

/**
 * 构建搜索查询生成 prompt
 * 包含当前日期信息，确保搜索查询使用正确的时间
 */
function buildSearchQueryPrompt(question: string): string {
  const dateInfo = getCurrentDateInfo();
  const userSpecifiedYear = extractYearFromQuestion(question);
  
  // 如果用户指定了年份，使用用户的年份；否则使用当前年份
  const targetYear = userSpecifiedYear || dateInfo.year;
  
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
/**
 * 搜索结果类型
 */
interface SearchAnalysis {
  search_queries: string[];
  reasoning: string;
}

/**
 * 观点输出类型
 */
interface PersonaOutput {
  thinking: string;
  answer: string;
}

/**
 * 裁决结果类型
 */
interface DeciderOutput {
  should_continue: boolean;
  reason: string;
  winner: 'optimistic' | 'pessimistic' | 'draw';
  summary: string;
}

// 常量配置
const MAX_SEARCH_RESULTS_LENGTH = 4000; // 增加到 4000 字符以获取更完整的上下文
const DEFAULT_FALLBACK_ANSWER = {
  optimistic: '乐观派分析暂时不可用，请稍后重试。',
  pessimistic: '悲观派分析暂时不可用，请稍后重试。',
};

/**
 * 研究员节点：分析用户问题，生成搜索查询，执行搜索，总结结果
 */
export const researcherNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting researcher node', { question: state.question });

  const llm = getLLMInstance();

  const analysisPrompt = buildSearchQueryPrompt(state.question);

  let analysis: SearchAnalysis;
  try {
    const analysisResponse = await withRetry(
      () => llm.invoke(analysisPrompt),
      2, // 最多重试 2 次
      1000
    );
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

  const searchResults = [];
  const totalQueries = analysis.search_queries.length;
  
  for (let i = 0; i < analysis.search_queries.length; i++) {
    const query = analysis.search_queries[i];
    
    // 发送搜索进度事件
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
      
      // 发送搜索结果事件
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
      
      // 添加延迟避免速率限制
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


  const engineUsage = searchResults.reduce((acc, r) => {
    if (r.engine !== 'error') {
      acc[r.engine] = (acc[r.engine] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  logger.info('Search engine usage', engineUsage);

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

    const summaryPrompt = `以下是搜索结果：

${truncatedResults}

请总结关键事实。严格以 JSON 格式返回：
{"key_facts": ["事实1"], "data_points": [{"source": "来源", "value": "数值", "context": "上下文"}], "summary": "总结"}`;

    // 发送分析进度事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'analyzing',
        data: {
          keyFactsCount: summary.key_facts.length,
          message: '正在生成研究总结...',
        },
      });
    }
    if (state.progressCallback) {
      state.progressCallback({
        type: 'analyzing',
        data: {
          keyFactsCount: summary.key_facts.length,
        },
      });
    }
    
    const summaryResponse = await withRetry(() => llm.invoke(summaryPrompt), 2, 1000);
    const parsed = await safeJsonParse(summaryResponse);
    summary = {
      key_facts: Array.isArray(parsed.key_facts) ? (parsed.key_facts as string[]) : [],
      data_points: Array.isArray(parsed.data_points)
        ? (parsed.data_points as Array<{ source: string; value: string; context: string }>)
        : [],
      summary: String(parsed.summary || '搜索完成'),
    };

    // 发送研究总结事件
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
    // 即使总结失败，也保留搜索结果的原始数据
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

/**
 * Optimistic Initial Node
 */
export const optimisticInitialNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting optimistic initial node', { question: state.question });

  const llm = getLLMInstance();

  const factsText = state.researchSummary?.key_facts?.map(f => `- ${f}`).join('\n') || '无';
  const dataText = state.researchSummary?.data_points?.map(d => `- ${d.context}: ${d.value}`).join('\n') || '无';

  const prompt = `你是一个乐观派分析师。

用户问题：${state.question}

背景信息：
${state.researchSummary?.summary || '无背景信息'}

关键事实：
${factsText}

数据点：
${dataText}

请从乐观角度分析这个问题。严格以 JSON 格式返回：
{"thinking": "思考过程", "answer": "乐观观点"}`;

  try {
    // 发送节点开始事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'node_start',
        data: {
          node: 'optimistic',
          message: '乐观派开始分析...',
        },
      });
    }

    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const output: PersonaOutput = {
      thinking: String(parsed.thinking || ''),
      answer: String(parsed.answer || DEFAULT_FALLBACK_ANSWER.optimistic),
    };

    // 发送乐观派输出事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'optimistic_output',
        data: {
          thinking: output.thinking,
          answer: output.answer,
        },
      });
    }

    logger.info('Optimistic initial node completed', { duration: Date.now() - startTime });

    return {
      optimisticThinking: output.thinking,
      optimisticAnswer: output.answer,
      round: 1,
    };
  } catch (error) {
    logger.error('Optimistic initial node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      optimisticThinking: '',
      optimisticAnswer: DEFAULT_FALLBACK_ANSWER.optimistic,
      round: 1,
    };
  }
};

/**
 * 悲观派初始节点
 */
export const pessimisticInitialNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting pessimistic initial node', { question: state.question });

  const llm = getLLMInstance();

  const factsText = state.researchSummary?.key_facts?.map(f => `- ${f}`).join('\n') || '无';
  const dataText = state.researchSummary?.data_points?.map(d => `- ${d.context}: ${d.value}`).join('\n') || '无';

  const prompt = `你是一个悲观派分析师。

用户问题：${state.question}

背景信息：
${state.researchSummary?.summary || '无背景信息'}

关键事实：
${factsText}

数据点：
${dataText}

请从悲观角度分析这个问题。严格以 JSON 格式返回：
{"thinking": "思考过程", "answer": "悲观观点"}`;

  try {
    // 发送节点开始事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'node_start',
        data: {
          node: 'pessimistic',
          message: '悲观派开始分析...',
        },
      });
    }

    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const output: PersonaOutput = {
      thinking: String(parsed.thinking || ''),
      answer: String(parsed.answer || DEFAULT_FALLBACK_ANSWER.pessimistic),
    };

    // 发送悲观派输出事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'pessimistic_output',
        data: {
          thinking: output.thinking,
          answer: output.answer,
        },
      });
    }

    logger.info('Pessimistic initial node completed', { duration: Date.now() - startTime });

    return {
      pessimisticThinking: output.thinking,
      pessimisticAnswer: output.answer,
    };
  } catch (error) {
    logger.error('Pessimistic node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      pessimisticThinking: '',
      pessimisticAnswer: DEFAULT_FALLBACK_ANSWER.pessimistic,
    };
  }
};

/**
 * 乐观派反驳节点
 */
export const optimisticRebuttalNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting optimistic rebuttal node', { round: state.round });

  const llm = getLLMInstance();

  const prompt = `你是一个乐观派分析师，正在进行辩论。

用户问题：${state.question}

你的初始观点：
${state.optimisticAnswer}

对方（悲观派）的观点：
${state.pessimisticAnswer}

请针对悲观派的观点进行反驳，补充新内容。严格以 JSON 格式返回：
{"rebuttal": "反驳内容"}`;

  try {
    // 发送节点开始事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'node_start',
        data: {
          node: 'optimistic_rebuttal',
          message: '乐观派正在反驳...',
        },
      });
    }

    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const rebuttal = String(parsed.rebuttal || '');

    // 发送乐观派反驳事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'optimistic_rebuttal',
        data: {
          rebuttal: rebuttal,
        },
      });
    }

    logger.info('Optimistic rebuttal node completed', { duration: Date.now() - startTime });

    return {
      optimisticRebuttal: rebuttal,
      optimisticAnswer: state.optimisticAnswer,
    };
  } catch (error) {
    logger.error('Optimistic rebuttal failed', { error: error instanceof Error ? error.message : String(error) });
    const fallbackRebuttal = '乐观派反驳暂时不可用。';
    return {
      optimisticRebuttal: fallbackRebuttal,
      optimisticAnswer: state.optimisticAnswer,
    };
  }
};

/**
 * 悲观派反驳节点
 */
export const pessimisticRebuttalNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting pessimistic rebuttal node', { round: state.round });

  const llm = getLLMInstance();

  const prompt = `你是一个悲观派分析师，正在进行辩论。

用户问题：${state.question}

你的初始观点：
${state.pessimisticAnswer}

对方（乐观派，含反驳）的观点：
${state.optimisticAnswer}

请针对乐观派的观点进行反驳，补充新内容。严格以 JSON 格式返回：
{"rebuttal": "反驳内容"}`;

  try {
    // 发送节点开始事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'node_start',
        data: {
          node: 'pessimistic_rebuttal',
          message: '悲观派正在反驳...',
        },
      });
    }

    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const rebuttal = String(parsed.rebuttal || '');

    // 发送悲观派反驳事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'pessimistic_rebuttal',
        data: {
          rebuttal: rebuttal,
        },
      });
    }

    logger.info('Pessimistic rebuttal node completed', { duration: Date.now() - startTime });

    return {
      pessimisticRebuttal: rebuttal,
      pessimisticAnswer: state.pessimisticAnswer + '\n\n【反驳】\n' + rebuttal,
    };
  } catch (error) {
    logger.error('Pessimistic rebuttal failed', { error: error instanceof Error ? error.message : String(error) });
    const fallbackRebuttal = '悲观派反驳暂时不可用。';
    return {
      pessimisticRebuttal: fallbackRebuttal,
      pessimisticAnswer: state.pessimisticAnswer + '\n\n【反驳】\n' + fallbackRebuttal,
    };
  }
};

/**
 * 裁决者节点
 * 使用完整论点进行裁决，而非截取前 300 字符
 */
export const deciderNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting decider node', { round: state.round });

  const llm = getLLMInstance();

  // 使用完整论点进行裁决，而非截取
  const optimisticView = state.optimisticAnswer;
  const pessimisticView = state.pessimisticAnswer;

  // 如果内容太长，提供结构化的摘要提示
  const formatArgument = (view: string, maxLen: number = 3000): string => {
    if (view.length <= maxLen) return view;
    return view.substring(0, maxLen) + '\n... (内容已截断)';
  };

  const prompt = `你是辩论裁决者。

用户问题：${state.question}

当前轮数：${state.round}/${state.maxRounds}

乐观派观点：
${formatArgument(optimisticView)}

悲观派观点：
${formatArgument(pessimisticView)}

请全面分析双方观点，判断是否需要继续辩论。严格以 JSON 格式返回：
{"should_continue": false, "reason": "判断理由", "winner": "optimistic/pessimistic/draw", "summary": "辩论总结"}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const output: DeciderOutput = {
      should_continue: Boolean(parsed.should_continue),
      reason: String(parsed.reason || ''),
      winner: (parsed.winner as 'optimistic' | 'pessimistic' | 'draw') || 'draw',
      summary: String(parsed.summary || ''),
    };

    logger.info('Decider node completed', {
      duration: Date.now() - startTime,
      shouldContinue: output.should_continue,
      winner: output.winner,
    });

    return {
      shouldContinue: output.should_continue,
      round: state.round + 1,
      debateWinner: output.winner,
      debateSummary: output.summary,
    };
  } catch (error) {
    logger.error('Decider node failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      shouldContinue: false,
      round: state.round + 1,
      debateWinner: 'draw',
      debateSummary: '裁决暂时不可用，请重试。',
    };
  }
};

// ==================== Deep Research Nodes ====================


/**
 * Planner Node: 生成研究计划
 * 将用户问题分解为多个子研究问题
 */
export const plannerNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting Planner node', { question: state.question, breadth: state.breadth });

  const llm = getLLMInstance();

  const dateInfo = getCurrentDateInfo();
  
  const prompt = `你是研究规划专家。请将以下问题分解为 ${state.breadth} 个简短的子研究问题。

研究问题：${state.question}

当前日期：${dateInfo.date}

要求：
1. 每个子问题简短（不超过30字）
2. 子问题之间互补
3. 适合搜索
4. 优先关注${dateInfo.year}年最新信息

请严格以 JSON 格式返回（简短回答，不要解释）：
{
  "subQueries": ["子问题1", "子问题2", "子问题3"]
}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    
    let subQueries: string[];
    if (Array.isArray(parsed.subQueries)) {
      // 新格式: ["问题1", "问题2"]
      subQueries = parsed.subQueries.map((item: any) => 
        typeof item === 'string' ? item : item.query
      );
    } else {
      subQueries = [state.question];
    }
    
    logger.info('Planner parsed subQueries', { subQueries });

    const subTasks: ResearchSubTask[] = subQueries.map((query: string, index: number) => ({
      id: `task-${Date.now()}-${index}`,
      query,
      depth: 1,
      status: 'pending',
    }));

    logger.info('Planner node completed', { duration: Date.now() - startTime, subQueryCount: subQueries.length });

    return {
      researchPlan: subQueries,
      subTasks,
      currentDepth: 1,
    };
  } catch (error) {
    logger.error('Planner node failed', { error: error instanceof Error ? error.message : String(error) });
    
    return {
      researchPlan: [state.question],
      subTasks: [{
        id: `task-${Date.now()}-0`,
        query: state.question,
        depth: 1,
        status: 'pending',
      }],
      currentDepth: 1,
    };
  }
};

/**
 * Parallel Research Node: 并行执行搜索
 */
export const parallelResearchNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  const pendingTasks = state.subTasks.filter(t => t.status === 'pending');
  
  if (pendingTasks.length === 0) {
    logger.info('No pending tasks, skipping parallel research');
    return {};
  }

  logger.info('Starting Parallel Research node', { pendingTaskCount: pendingTasks.length, currentDepth: state.currentDepth });

  try {
    const updatedTasks = [...state.subTasks];
    const newFindings: ResearchFinding[] = [];

    // 逐个搜索并发送实时事件
    for (let i = 0; i < pendingTasks.length; i++) {
      const task = pendingTasks[i];
      
      // 发送搜索开始事件
      if (state.progressCallback) {
        state.progressCallback({
          type: 'searching',
          data: {
            currentQuery: task.query,
            currentIndex: i + 1,
            totalQueries: pendingTasks.length,
            progress: Math.round((i / pendingTasks.length) * 100),
          },
        });
      }
      
      const result = await smartSearch(task.query);
      
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
      
      const taskIndex = updatedTasks.findIndex(t => t.id === task.id);
      
      if (taskIndex !== -1) {
        const content = result.results.map(r => `${r.title}: ${r.description}`).join('\n');
        
        updatedTasks[taskIndex] = {
          ...updatedTasks[taskIndex],
          status: result.results.length > 0 ? 'completed' : 'failed',
          result: content,
          sources: result.results.map(r => r.url),
        };

        if (result.results.length > 0) {
          newFindings.push({
            query: task.query,
            content,
            depth: task.depth,
            sources: result.results.map(r => r.url),
          });
        }
      }
      
      // 添加延迟避免速率限制
      if (i < pendingTasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    logger.info('Parallel Research node completed', { duration: Date.now() - startTime, findingsCount: newFindings.length });

    return {
      subTasks: updatedTasks,
      allFindings: [...state.allFindings, ...newFindings],
    };
  } catch (error) {
    logger.error('Parallel Research node failed', { error: error instanceof Error ? error.message : String(error) });
    
    const updatedTasks = state.subTasks.map(t => 
      t.status === 'pending' ? { ...t, status: 'failed' as const } : t
    );
    
    return { subTasks: updatedTasks };
  }
};

/**
 * Deep Check Node: 决定是否继续深入研究
 */
export const deepCheckNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  
  if (state.currentDepth >= state.maxDepth) {
    logger.info('Max depth reached, synthesizing findings');
    return synthesizeFindings(state);
  }

  const completedFindings = state.allFindings.filter(f => f.depth === state.currentDepth);
  
  if (completedFindings.length === 0) {
    logger.warn('No findings at current depth, synthesizing');
    return synthesizeFindings(state);
  }

  logger.info('Starting Deep Check node', { currentDepth: state.currentDepth, maxDepth: state.maxDepth, findingCount: completedFindings.length });

  const llm = getLLMInstance();

  const findingsText = completedFindings
    .map(f => `Query: ${f.query}\nContent: ${f.content.substring(0, 500)}...`)
    .join('\n\n');

  const prompt = `基于以下研究发现，判断是否需要进行更深入的子研究？

当前深度：${state.currentDepth}/${state.maxDepth}
已有发现：
${findingsText || '暂无'}

请判断：
1. 是否需要生成新的子问题进行更深入的研究？
2. 如果需要，列出 2-3 个新的研究角度

严格以 JSON 格式返回：
{
  "shouldContinue": true/false,
  "reason": "判断理由",
  "newAngles": ["新角度1", "新角度2"]
}`;

  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    
    const shouldContinue = Boolean(parsed.shouldContinue);
    const newAngles: string[] = Array.isArray(parsed.newAngles) ? parsed.newAngles : [];

    if (shouldContinue && newAngles.length > 0 && state.currentDepth < state.maxDepth) {
      const newTasks: ResearchSubTask[] = newAngles.map((angle: string, index: number) => ({
        id: `task-${Date.now()}-${state.currentDepth}-${index}`,
        query: angle,
        parentId: state.subTasks.find(t => t.status === 'completed')?.id,
        depth: state.currentDepth + 1,
        status: 'pending',
      }));

      logger.info('Deep Check: Continuing to next depth', { duration: Date.now() - startTime, newTaskCount: newTasks.length });

      return {
        subTasks: [...state.subTasks, ...newTasks],
        currentDepth: state.currentDepth + 1,
      };
    }

    logger.info('Deep Check: Synthesizing findings');
    return synthesizeFindings(state);

  } catch (error) {
    logger.error('Deep Check node failed', { error: error instanceof Error ? error.message : String(error) });
    return synthesizeFindings(state);
  }
};

/**
 * 综合研究发现
 */
function synthesizeFindings(state: GraphState): Partial<GraphState> {
  const findings = state.allFindings;
  
  if (findings.length === 0) {
    return {
      researchSummary: {
        summary: '未获取到有效研究结果',
        key_facts: [],
        data_points: [],
      },
    };
  }

  const byDepth = findings.reduce((acc, f) => {
    acc[f.depth] = acc[f.depth] || [];
    acc[f.depth].push(f);
    return acc;
  }, {} as Record<number, typeof findings>);

  const keyFacts = findings.map(f => `${f.query}: ${f.content.substring(0, 200)}...`);
  
  const dataPoints: DataPoint[] = findings.flatMap(f => 
    f.sources.map(url => ({
      source: url,
      value: f.query,
      context: f.content.substring(0, 100),
    }))
  );

  // 简化总结，主要保留关键事实
  let summary = `${state.question} 的研究发现：\n\n`;

  Object.entries(byDepth)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([depth, items]) => {
      summary += `### 第 ${depth} 层发现\n\n`;
      items.forEach(item => {
        summary += `**${item.query}**\n`;
        summary += `${item.content.substring(0, 300)}...\n\n`;
      });
    });

  logger.info('Findings synthesized', { totalFindings: findings.length, keyFactsCount: keyFacts.length, dataPointsCount: dataPoints.length });

  return {
    researchSummary: {
      summary,
      key_facts: keyFacts,
      data_points: dataPoints,
    },
    allFindings: state.allFindings,
  };
}

// ==================== Deep Research Nodes ====================
