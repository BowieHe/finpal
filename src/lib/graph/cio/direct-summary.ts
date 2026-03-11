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

  const prompt = `你是一位专业的金融助手。
请基于以下智能 Agent 收集到的最新数据，直接回答用户的问题。不需要进行观点辩论。

用户问题：${state.question}

系统收集到的数据：
${contextStr}

分析要求：
1. 语言要专业、简洁、直接。
2. 引用数据时要准确。
3. 如果存在适合图表展示的数据关系（如资产配置的饼图、近期收益的趋势折线图或柱状图、流程结构等），请务必在你的回答中嵌入 Markdown 的 \`\`\`mermaid\`\`\` 代码块以呈现直观的图表。如果是对比项清单，也可以使用普通的 Markdown 表格。

请以JSON格式返回：{"summary": "你的最终 Markdown 回答内容"}`;

  try {
    let streamedContent = '';
    const fullResponse = await streamWithCallback(
      prompt,
      (chunk) => {
        streamedContent += chunk;
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
