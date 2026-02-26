import { GraphState } from './state';
import { getLLMInstance } from '../llm/client';
import { OPTIMISTIC_PROMPT, PESSIMISTIC_PROMPT } from '../prompts';
import { smartSearch } from '../mcp/unified-search';

function extractJSONFromText(text: string): any {
  try {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error('[JSON Parser] Failed to parse JSON from text:', text);
    return null;
  }
}

export const researcherNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  console.log('[Graph] Starting researcher node');

  const llm = getLLMInstance();

  const analysisPrompt = `你是信息收集专家。

用户问题：${state.question}

请分析这个问题，并生成 2-3 个有效的搜索查询。

请以 JSON 格式返回：
{
  "search_queries": [
    "搜索查询1",
    "搜索查询2",
    "搜索查询3"
  ],
  "reasoning": "你的推理过程"
}`;

  const analysisResponse = await llm.invoke(analysisPrompt);
  
  let analysis: { search_queries: string[]; reasoning: string };
  try {
    analysis = JSON.parse(analysisResponse.content as string);
  } catch (parseError) {
    console.error('[Researcher] Failed to parse analysis as JSON, attempting to extract JSON from text');
    analysis = extractJSONFromText(analysisResponse.content as string);
    if (!analysis) {
      console.error('[Researcher] Could not extract JSON from analysis response');
      analysis = { search_queries: ['搜索查询1', '搜索查询2'], reasoning: '解析失败，使用默认查询' };
    }
  }

  console.log('[Researcher] Generated search queries:', analysis.search_queries);

  const searchPromises = analysis.search_queries.map(async (query) => {
    return await smartSearch(query);
  });

  const searchResults = await Promise.all(searchPromises);

  const engineUsage = searchResults.reduce((acc, r) => {
    if (r.engine !== 'error') {
      acc[r.engine] = (acc[r.engine] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  console.log('[Researcher] Search engine usage:', engineUsage);

  const summaryPrompt = `以下是来自不同搜索引擎的搜索结果：

${JSON.stringify(searchResults, null, 2)}

请总结关键事实和数据，并标注信息来源。

请以 JSON 格式返回：
{
  "key_facts": ["事实1", "事实2", ...],
  "data_points": [{"source": "来源", "value": "数值", "context": "上下文"}, ...],
  "summary": "整体总结"
}`;

  const summaryResponse = await llm.invoke(summaryPrompt);
  const summary = JSON.parse(summaryResponse.content as string);

  const duration = Date.now() - startTime;
  console.log('[Graph] Researcher node completed:', {
    duration: `${duration}ms`,
    searchCount: searchResults.length,
  });

  return {
    searchResults,
    researchSummary: summary,
    engineUsage,
  };
};

export const optimisticInitialNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  console.log('[Graph] Starting optimistic initial node');

  const llm = getLLMInstance();

  const prompt = `你是一个乐观派的人格。

用户问题：${state.question}

**背景信息：**
${state.researchSummary?.summary || '无'}

**关键事实：**
${state.researchSummary?.key_facts?.map(f => `- ${f}`).join('\n') || '无'}

**数据点：**
${state.researchSummary?.data_points?.map(d => `- ${d.context}: ${d.value} (来源: ${d.source})`).join('\n') || '无'}

请基于以上事实和数据，从乐观角度分析这个问题。

请以 JSON 格式返回：
{
  "thinking": "你的思考过程，如何基于事实进行分析",
  "answer": "你的乐观观点",
  "data_used": ["使用了哪些具体的数据点"]
}`;

  const response = await llm.invoke(prompt);
  const parsed = JSON.parse(response.content as string);

  const duration = Date.now() - startTime;
  console.log('[Graph] Optimistic initial node completed:', {
    duration: `${duration}ms`,
    responseLength: response.content.length,
  });

  return {
    optimisticThinking: parsed.thinking,
    optimisticAnswer: parsed.answer,
    round: 1,
  };
};

export const pessimisticInitialNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  console.log('[Graph] Starting pessimistic initial node');

  const llm = getLLMInstance();

  const prompt = `你是一个悲观派的人格。

用户问题：${state.question}

**背景信息：**
${state.researchSummary?.summary || '无'}

**关键事实：**
${state.researchSummary?.key_facts?.map((f: string) => `- ${f}`).join('\n') || '无'}

**数据点：**
${state.researchSummary?.data_points?.map((d: { source: string; value: string; context: string }) => `- ${d.context}: ${d.value} (来源: ${d.source})`).join('\n') || '无'}

请基于以上事实和数据，从悲观角度分析这个问题。

请以 JSON 格式返回：
{
  "thinking": "你的思考过程，如何基于事实进行分析",
  "answer": "你的悲观观点",
  "data_used": ["使用了哪些具体的数据点"]
}`;

  const response = await llm.invoke(prompt);
  const parsed = JSON.parse(response.content as string);

  const duration = Date.now() - startTime;
  console.log('[Graph] Pessimistic initial node completed:', {
    duration: `${duration}ms`,
    responseLength: response.content.length,
  });

  return {
    pessimisticThinking: parsed.thinking,
    pessimisticAnswer: parsed.answer,
  };
};

export const optimisticRebuttalNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  console.log('[Graph] Starting optimistic rebuttal node');

  const llm = getLLMInstance();

  const prompt = `你是一个乐观派的人格。

用户问题：${state.question}

**你的观点：**
${state.optimisticAnswer}

**悲观派的观点：**
${state.pessimisticAnswer}

请针对悲观派的观点进行反驳，补充新的内容。不要重复之前的观点。

请以 JSON 格式返回：
{
  "rebuttal": "你的反驳内容",
  "data_used": ["新使用的数据点"]
}`;

  const response = await llm.invoke(prompt);
  const parsed = JSON.parse(response.content as string);

  const duration = Date.now() - startTime;
  console.log('[Graph] Optimistic rebuttal node completed:', {
    duration: `${duration}ms`,
    responseLength: response.content.length,
  });

  return {
    optimisticRebuttal: parsed.rebuttal,
    optimisticAnswer: state.optimisticAnswer + '\n\n[反驳]\n' + parsed.rebuttal,
  };
};

export const pessimisticRebuttalNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  console.log('[Graph] Starting pessimistic rebuttal node');

  const llm = getLLMInstance();

  const prompt = `你是一个悲观派的人格。

用户问题：${state.question}

**悲观派的观点：**
${state.pessimisticAnswer}

**乐观派的观点（含反驳）：**
${state.optimisticAnswer}

请针对乐观派的观点进行反驳，补充新的内容。不要重复之前的观点。

请以 JSON 格式返回：
{
  "rebuttal": "你的反驳内容",
  "data_used": ["新使用的数据点"]
}`;

  const response = await llm.invoke(prompt);
  const parsed = JSON.parse(response.content as string);

  const duration = Date.now() - startTime;
  console.log('[Graph] Pessimistic rebuttal node completed:', {
    duration: `${duration}ms`,
    responseLength: response.content.length,
  });

  return {
    pessimisticRebuttal: parsed.rebuttal,
    pessimisticAnswer: state.pessimisticAnswer + '\n\n[反驳]\n' + parsed.rebuttal,
  };
};

export const deciderNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  console.log('[Graph] Starting decider node');

  const llm = getLLMInstance();

  const prompt = `你是辩论的裁决者。

用户问题：${state.question}

背景：
- 当前轮数：${state.round}/${state.maxRounds}
- 乐观派观点：${state.optimisticAnswer.substring(0, 200)}...
- 悲观派观点：${state.pessimisticAnswer.substring(0, 200)}...

判断是否需要继续辩论：
1. 双方观点是否已经充分表达
2. 是否有新的有价值的内容产生
3. 是否达到最大轮数

请以 JSON 格式返回：
{
  "should_continue": true/false,
  "reason": "判断理由"
}`;

  const response = await llm.invoke(prompt);
  const parsed = JSON.parse(response.content as string);

  const duration = Date.now() - startTime;
  console.log('[Graph] Decider node completed:', {
    duration: `${duration}ms`,
    shouldContinue: parsed.should_continue,
  });

  return {
    shouldContinue: parsed.should_continue,
    round: state.round + 1,
  };
};
