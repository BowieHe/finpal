/**
 * LLM-as-a-Judge 评估器
 * 
 * 使用 LLM 评估搜索结果质量和最终报告质量
 */

import { SearchResult } from '@/types/mcp';
import { getLLMInstance } from '@/lib/llm/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Judge');

/**
 * 评估结果接口
 */
export interface EvaluationResult {
  qualityScore: number;        // 0-10 整体质量
  relevanceScore: number;      // 0-10 信息相关性
  completenessScore: number;   // 0-10 信息完整性
  clarityScore: number;        // 0-10 表达清晰度
  actionabilityScore: number;  // 0-10 可执行性
  reasoning: string;           // 详细评分理由
}

/**
 * 搜索质量评估结果
 */
export interface SearchQualityResult {
  searchRelevance: number;     // 0-10 搜索相关性
  coverageScore: number;       // 0-10 覆盖完整性
  diversityScore: number;      // 0-10 信息多样性
  freshnessScore: number;      // 0-10 信息时效性
  reasoning: string;
}

/**
 * 使用 LLM 评估搜索结果质量
 */
export async function evaluateSearchQuality(
  question: string,
  searchResult: SearchResult
): Promise<SearchQualityResult> {
  try {
    const llm = await getLLMInstance();
    
    const prompt = `你是一位专业的投资研究质量评估专家。

用户问题："${question}"

搜索结果：
查询词：${searchResult.query}
引擎：${searchResult.engine}
结果数量：${searchResult.results.length}

搜索结果详情：
${searchResult.results.map((r, i) => `
[${i + 1}] ${r.title}
URL: ${r.url}
摘要: ${r.description?.slice(0, 200)}...
`).join('\n')}

请从以下维度评估这次搜索的质量（0-10分）：

1. **搜索相关性** (searchRelevance): 搜索结果与用户问题的匹配程度
2. **覆盖完整性** (coverageScore): 是否覆盖了问题的主要方面
3. **信息多样性** (diversityScore): 来源是否多样，观点是否平衡
4. **信息时效性** (freshnessScore): 是否包含最新的相关信息

请以 JSON 格式输出：
{
  "searchRelevance": number,
  "coverageScore": number,
  "diversityScore": number,
  "freshnessScore": number,
  "reasoning": "详细的评分理由，指出优点和需要改进的地方"
}

注意：只输出 JSON，不要输出其他内容。`;

    const response = await llm.invoke(prompt);
    const content = response.content as string;
    
    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从 LLM 响应中提取 JSON');
    }
    
    const result = JSON.parse(jsonMatch[0]) as SearchQualityResult;
    
    // 验证并归一化分数
    return {
      searchRelevance: normalizeScore(result.searchRelevance),
      coverageScore: normalizeScore(result.coverageScore),
      diversityScore: normalizeScore(result.diversityScore),
      freshnessScore: normalizeScore(result.freshnessScore),
      reasoning: result.reasoning || '无评分理由',
    };
  } catch (error) {
    logger.error('搜索质量评估失败', { error, question });
    return {
      searchRelevance: 5,
      coverageScore: 5,
      diversityScore: 5,
      freshnessScore: 5,
      reasoning: `评估失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 使用 LLM 评估最终报告质量
 */
export async function evaluateFinalReport(
  question: string,
  searchResult: SearchResult,
  finalReport: string,
  debateContext?: {
    optimisticView?: string;
    pessimisticView?: string;
    rounds?: number;
  }
): Promise<EvaluationResult> {
  try {
    const llm = await getLLMInstance();
    
    const debateInfo = debateContext ? `
辩论背景：
- 辩论轮数：${debateContext.rounds || '未知'}
- 乐观派观点摘要：${debateContext.optimisticView?.slice(0, 200) || '无'}
- 悲观派观点摘要：${debateContext.pessimisticView?.slice(0, 200) || '无'}
` : '';
    
    const prompt = `你是一位严格的投资分析报告质量评估专家。

用户原始问题："${question}"

搜索信息：
- 查询：${searchResult.query}
- 找到 ${searchResult.results.length} 条结果
${debateInfo}

最终报告：
${finalReport.slice(0, 2000)}${finalReport.length > 2000 ? '\n...(报告已截断)' : ''}

请从以下维度评估这份报告的质量（0-10分）：

1. **整体质量** (qualityScore): 报告是否准确、有深度、有实用性
   - 10分：专业投资分析师水准，有独特洞察
   - 7分：信息完整，分析合理，有一定深度
   - 5分：基本信息正确，但缺乏深度
   - 3分：信息片面或有一些错误
   - 1分：几乎无用或严重错误

2. **信息相关性** (relevanceScore): 内容是否针对用户问题
   - 10分：完全切题，没有无关内容
   - 5分：基本相关，但有一些跑题
   - 1分：答非所问

3. **信息完整性** (completenessScore): 是否覆盖了问题的关键维度
   - 10分：全面覆盖所有相关维度
   - 5分：覆盖了主要方面，但有所遗漏
   - 1分：严重缺失关键信息

4. **表达清晰度** (clarityScore): 逻辑是否清晰，易于理解
   - 10分：结构清晰，表达流畅，易于理解
   - 5分：基本清楚，但有些地方表达不够清晰
   - 1分：混乱难懂

5. **可执行性** (actionabilityScore): 是否给出了可执行的建议
   - 10分：明确、具体、可执行的建议
   - 5分：有一些建议，但不够具体
   - 1分：没有实质建议或建议不可行

请以 JSON 格式输出：
{
  "qualityScore": number,
  "relevanceScore": number,
  "completenessScore": number,
  "clarityScore": number,
  "actionabilityScore": number,
  "reasoning": "详细的评分理由，包括优点、缺点和改进建议"
}

注意：
1. 只输出 JSON，不要输出其他内容
2. 评分要客观严格，不要盲目给高分
3. 报告质量应该与专业投资分析师的报告对比`;

    const response = await llm.invoke(prompt);
    const content = response.content as string;
    
    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从 LLM 响应中提取 JSON');
    }
    
    const result = JSON.parse(jsonMatch[0]) as EvaluationResult;
    
    // 验证并归一化分数
    return {
      qualityScore: normalizeScore(result.qualityScore),
      relevanceScore: normalizeScore(result.relevanceScore),
      completenessScore: normalizeScore(result.completenessScore),
      clarityScore: normalizeScore(result.clarityScore),
      actionabilityScore: normalizeScore(result.actionabilityScore),
      reasoning: result.reasoning || '无评分理由',
    };
  } catch (error) {
    logger.error('报告质量评估失败', { error, question });
    return {
      qualityScore: 5,
      relevanceScore: 5,
      completenessScore: 5,
      clarityScore: 5,
      actionabilityScore: 5,
      reasoning: `评估失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 计算综合质量分（加权平均）
 */
export function calculateOverallScore(evaluation: EvaluationResult): number {
  const weights = {
    qualityScore: 0.35,
    relevanceScore: 0.25,
    completenessScore: 0.20,
    clarityScore: 0.10,
    actionabilityScore: 0.10,
  };
  
  return (
    evaluation.qualityScore * weights.qualityScore +
    evaluation.relevanceScore * weights.relevanceScore +
    evaluation.completenessScore * weights.completenessScore +
    evaluation.clarityScore * weights.clarityScore +
    evaluation.actionabilityScore * weights.actionabilityScore
  );
}

/**
 * 计算搜索综合分
 */
export function calculateSearchOverallScore(searchEval: SearchQualityResult): number {
  const weights = {
    searchRelevance: 0.40,
    coverageScore: 0.30,
    diversityScore: 0.15,
    freshnessScore: 0.15,
  };
  
  return (
    searchEval.searchRelevance * weights.searchRelevance +
    searchEval.coverageScore * weights.coverageScore +
    searchEval.diversityScore * weights.diversityScore +
    searchEval.freshnessScore * weights.freshnessScore
  );
}

/**
 * 归一化分数到 0-10 范围
 */
function normalizeScore(score: number): number {
  if (typeof score !== 'number' || isNaN(score)) return 5;
  if (score < 0) return 0;
  if (score > 10) return 10;
  return Math.round(score * 10) / 10;
}

/**
 * 批量评估搜索结果
 */
export async function batchEvaluateSearches(
  evaluations: Array<{ question: string; searchResult: SearchResult }>
): Promise<SearchQualityResult[]> {
  const results: SearchQualityResult[] = [];
  
  for (const { question, searchResult } of evaluations) {
    const result = await evaluateSearchQuality(question, searchResult);
    results.push(result);
    // 添加延迟避免 rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}
