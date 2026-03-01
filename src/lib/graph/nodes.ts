import { GraphState, ResearchSummary } from './state';
import { getLLMInstance, withRetry } from '../llm/client';
import { smartSearch } from '../mcp/unified-search';
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

  const result = extractJSONFromText(contentStr);
  if (result) {
    return result;
  }

  throw new Error(`Failed to parse LLM response as JSON: ${contentStr.substring(0, 200)}...`);
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

  const analysisPrompt = `你是信息收集专家。

用户问题：${state.question}

请分析这个问题，并生成 2-3 个有效的搜索查询。

请严格以 JSON 格式返回（不要有其他文字）：
{"search_queries": ["查询1", "查询2"], "reasoning": "推理过程"}`;

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
  for (const query of analysis.search_queries) {
    try {
      const result = await smartSearch(query, { strategy: state.searchStrategy });
      searchResults.push(result);
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

    const summaryResponse = await withRetry(() => llm.invoke(summaryPrompt), 2, 1000);
    const parsed = await safeJsonParse(summaryResponse);
    summary = {
      key_facts: Array.isArray(parsed.key_facts) ? (parsed.key_facts as string[]) : [],
      data_points: Array.isArray(parsed.data_points)
        ? (parsed.data_points as Array<{ source: string; value: string; context: string }>)
        : [],
      summary: String(parsed.summary || '搜索完成'),
    };
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
 * 乐观派初始节点
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
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const output: PersonaOutput = {
      thinking: String(parsed.thinking || ''),
      answer: String(parsed.answer || DEFAULT_FALLBACK_ANSWER.optimistic),
    };

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
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const output: PersonaOutput = {
      thinking: String(parsed.thinking || ''),
      answer: String(parsed.answer || DEFAULT_FALLBACK_ANSWER.pessimistic),
    };

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
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const rebuttal = String(parsed.rebuttal || '');

    logger.info('Optimistic rebuttal node completed', { duration: Date.now() - startTime });

    return {
      optimisticRebuttal: rebuttal,
      optimisticAnswer: state.optimisticAnswer + '\n\n【反驳】\n' + rebuttal,
    };
  } catch (error) {
    logger.error('Optimistic rebuttal failed', { error: error instanceof Error ? error.message : String(error) });
    const fallbackRebuttal = '乐观派反驳暂时不可用。';
    return {
      optimisticRebuttal: fallbackRebuttal,
      optimisticAnswer: state.optimisticAnswer + '\n\n【反驳】\n' + fallbackRebuttal,
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
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const parsed = await safeJsonParse(response);
    const rebuttal = String(parsed.rebuttal || '');

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
