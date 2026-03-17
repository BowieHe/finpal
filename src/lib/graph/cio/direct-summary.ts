import { GraphState } from '../state';
import { getLLMInstance, streamWithCallback } from '../../llm/client';
import { extractJSONFromText } from '../nodes';
import { createLogger } from '../../logger';

const logger = createLogger('DirectSummary');

/**
 * 直接总结节点 (Short-circuit route)
 * 当 Intent Planner 判断 requiresDebate = false 时触发
 */
export const directSummaryNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Starting direct summary node');

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'decider', message: '正在根据最终检索结果生成回答...' } // 伪装成 decider，以便 UI 适配
    });
  }

  const collectedDataObj = state.collectedData || {};
  let contextStr = '';

  for (const [key, result] of Object.entries(collectedDataObj)) {
      contextStr += `\n--- 数据 ${key} ---\n${JSON.stringify(result, null, 2)}`;
  }

  const prompt = `你是一位经验丰富的量化投资研究主管。
请根据以下由多个智能 Agent 收集到的全动态实时数据，为用户提供一份专业、严谨且具有深度洞察的分析报告。

【用户问题】
${state.question}

【系统收集到的多维度数据】
${contextStr}

【分析报告要求（必须严格遵守）】
1. **结构化呈现**：使用清晰的 Markdown 标题（如：核心结论、核心风险、投资建议）。
2. **数据支撑**：在分析中必须显式引用上述收集到的关键数据（如：具体收益率、回撤百分比、具体的宏观新闻等）。
3. **图表增强**：如果存在对比、占比、趋势类数据，请务必嵌入 Markdown \`\`\`mermaid\`\`\` 代码块。
4. **决策质量**：你的回答应当直接、客观。如果数据表明存在重大风险，请直接指出，不要含糊。

【最终返回要求】
请先流式输出你的完整 Markdown 报告。报告结束后，在一个独立的 Markdown JSON 代码块中返回摘要摘要（用于 UI 概览）：
\`\`\`json
{"summary": "你的最终 Markdown 回答内容（或者一个精炼的摘要版本）"}
\`\`\`
报告正文不要包含 JSON 块。
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
            data: {
              node: 'decider',
              chunk: chunk,
            },
          });
        }
      },
      2
    );

    const parsed = extractJSONFromText(fullResponse);
    if (!parsed) throw new Error('Failed to parse direct summary');

    const summary = String(parsed.summary || '');

    // 发送最终完成事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'complete',
        data: { summary, winner: 'draw' },
      });
    }

    logger.info('Direct summary node completed', { duration: Date.now() - startTime });
    return { debateSummary: summary, debateWinner: 'draw' };
  } catch (error) {
    logger.error('Direct summary node failed', { error: error instanceof Error ? error.message : String(error) });
    return { debateSummary: '总结过程出错' };
  }
};
