/**
 * DeepAgent Node
 *
 * 将 DeepAgent 封装为 LangGraph 节点
 * 替代原有的 intentPlanner → agents → gateKeeper → synthesizer → debate 流程
 */

import { GraphState } from '../state';
import { createDeepAgent } from '@/lib/deepagent';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DeepAgentNode');

/**
 * 从问题中提取实体
 */
function extractEntity(question: string): string {
  // 尝试提取基金代码 (6位数字)
  const fundCodeMatch = question.match(/(\d{6})/);
  if (fundCodeMatch) {
    return fundCodeMatch[1];
  }

  // 提取引号内的内容
  const quotedMatch = question.match(/[""']([^""']+)[""']/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // 移除常见词汇，剩下的作为实体
  const cleaned = question
    .replace(/分析|研究|看看|查询|怎么样|如何|建议/g, '')
    .replace(/[.,!?。，！？]/g, '')
    .trim();

  return cleaned || question;
}

/**
 * DeepAgent Graph 节点
 */
export const deepAgentNode = async (
  state: GraphState
): Promise<Partial<GraphState>> => {
  logger.info('DeepAgent node starting', { question: state.question });

  const startTime = Date.now();

  try {
    // 提取实体
    const entity = extractEntity(state.question);

    // 发送 agent_start 事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'agent_start',
        data: {
          agentId: 'deep-agent',
          taskDescription: `深度分析: ${entity}`,
        },
      });
    }

    // 创建 DeepAgent 实例
    const agent = await createDeepAgent({
      maxSteps: 5,
      confidenceThreshold: 0.6,
      onProgress: (event) => {
        if (!state.progressCallback) return;

        // 将 DeepAgent 事件直接透传给前端需要的 event 类型
        const directEvents = [
          'searching',
          'search_result',
          'search_complete',
          'db_query',
          'db_result',
        ];
        if (directEvents.includes(event.type)) {
          state.progressCallback({
            type: event.type,
            data: event.data,
          } as any);
          return;
        }

        state.progressCallback({
          type: 'agent_progress',
          data: {
            step: event.step,
            message: event.message,
            agentId: 'deep-agent',
            detail: event.data,
          },
        });
      },
    });

    if (state.progressCallback) {
      state.progressCallback({
        type: 'node_start',
        data: { node: 'deepAgent', message: `启动深度分析: ${entity}` },
      });
    }

    // 执行 DeepAgent
    const result = await agent.execute(state.question, entity);

    const duration = Date.now() - startTime;
    logger.info('DeepAgent node completed', {
      duration,
      steps: result.totalSteps,
      success: result.success,
    });

    if (!result.success) {
      // 发送 agent_error 事件
      if (state.progressCallback) {
        state.progressCallback({
          type: 'agent_error',
          data: {
            agentId: 'deep-agent',
            error: result.error || 'DeepAgent 执行失败',
          },
        });
      }
      return {
        errors: [...(state.errors || []), `DeepAgent 执行失败: ${result.error}`],
      };
    }

    // 检查是否是直接回答场景（没有 debate 数据，但有 thoughts 包含回答）
    const debateData = result.data;
    const hasDebateData = debateData && (debateData.bullCase || debateData.bearCase || debateData.synthesis);

    // 如果没有辩论数据，检查是否有直接回答（从最后一个 thought 的 reason 中提取）
    if (!hasDebateData && result.thoughts.length > 0) {
      const lastThought = result.thoughts[result.thoughts.length - 1];
      const directAnswer = lastThought.content || '收到您的问题，但我需要基金名称才能进行分析。';

      logger.info('Direct answer detected', { answer: directAnswer.substring(0, 100) });

      // 发送 direct_answer 事件（前端专用）
      if (state.progressCallback) {
        state.progressCallback({
          type: 'direct_answer',
          data: {
            answer: directAnswer,
            agentId: 'deep-agent',
          },
        });
      }

      // 发送 agent_done 事件
      if (state.progressCallback) {
        state.progressCallback({
          type: 'agent_done',
          data: {
            agentId: 'deep-agent',
            duration: duration,
            skillsUsed: result.skillsUsed,
            summary: directAnswer,
            findings: result.observations.map(obs => ({
              skill: obs.skillName,
              confidence: obs.output.confidence,
              data: obs.output.data,
            })),
            results: [{ directAnswer }],
          },
        });

        // 发送 complete 事件
        state.progressCallback({
          type: 'complete',
          data: {
            message: directAnswer,
            winner: 'draw',
            summary: directAnswer,
          },
        });
      }

      // 返回直接回答的状态
      return {
        researchSummary: {
          summary: directAnswer,
          key_facts: result.thoughts.map(t => t.content),
          data_points: [],
        },
        optimisticAnswer: directAnswer,
        pessimisticAnswer: '',
        debateWinner: 'draw',
        debateSummary: directAnswer,
        debateHistory: [{
          round: 1,
          optimisticAnswer: directAnswer,
          pessimisticAnswer: '',
        }],
      };
    }

    // 正常基金分析流程（有 debate 数据）
    const bullCase = debateData?.bullCase;
    const bearCase = debateData?.bearCase;
    const synthesis = debateData?.synthesis;
    const evCalculation = debateData?.evCalculation;

    // 发送 optimistic_output 事件 (流式效果)
    if (state.progressCallback && bullCase?.thesis) {
      state.progressCallback({
        type: 'optimistic_output',
        data: {
          answer: bullCase.thesis,
          thinking: bullCase.catalysts?.join('\n') || '',
        },
      });
    }

    // 发送 pessimistic_output 事件 (流式效果)
    if (state.progressCallback && bearCase?.thesis) {
      state.progressCallback({
        type: 'pessimistic_output',
        data: {
          answer: bearCase.thesis,
          thinking: bearCase.risks?.join('\n') || '',
        },
      });
    }

    // 发送 agent_done 事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'agent_done',
        data: {
          agentId: 'deep-agent',
          duration: duration,
          skillsUsed: result.skillsUsed,
          summary: synthesis?.summary || '分析完成',
          findings: result.observations.map(obs => ({
            skill: obs.skillName,
            confidence: obs.output.confidence,
            data: obs.output.data,
          })),
          results: [{
            bullCase,
            bearCase,
            synthesis,
            evCalculation,
          }],
        },
      });
    }

    // 映射 DeepAgent 结果到 GraphState
    const updates: Partial<GraphState> = {
      // 研究总结
      researchSummary: {
        summary: synthesis?.summary || `DeepAgent 完成 ${result.totalSteps} 步分析`,
        key_facts: result.thoughts.map(t => t.content),
        data_points: result.observations.map(obs => ({
          source: obs.skillName,
          value: obs.output.success ? '成功' : '失败',
          context: `置信度: ${(obs.output.confidence * 100).toFixed(0)}%`,
        })),
      },

      // 辩论数据
      optimisticAnswer: bullCase?.thesis || '',
      optimisticData: bullCase ? {
        probability: {
          baseRate: 50,
          adjustedRate: bullCase.confidence,
          adjustmentReason: 'DeepAgent 分析',
        },
        payoff: {
          upsidePotential: 15,
          downsideRisk: -10,
          timeframe: synthesis?.timeHorizon || '6-12个月',
          expectedReturn: evCalculation?.expectedReturn || 0,
        },
        catalysts: bullCase.catalysts || [],
        keyRisks: bearCase?.risks || [],
        confidenceLevel: bullCase.confidence,
      } : null,

      pessimisticAnswer: bearCase?.thesis || '',
      pessimisticData: bearCase ? {
        probability: {
          downsideProbability: 100 - bearCase.confidence,
          severity: 'medium',
          timeline: synthesis?.timeHorizon || '6-12个月',
        },
        payoff: {
          upsideCap: 10,
          downsideRisk: -15,
          timeframe: synthesis?.timeHorizon || '6-12个月',
          expectedReturn: evCalculation?.expectedReturn || 0,
        },
        riskFactors: (bearCase.risks || []).map((r: string) => ({
          description: r,
          severity: 'medium' as const,
          probability: 50,
        })),
        catalystsForDecline: [],
        confidenceLevel: bearCase.confidence,
      } : null,

      // 辩论历史
      debateHistory: [{
        round: 1,
        optimisticAnswer: bullCase?.thesis || '',
        pessimisticAnswer: bearCase?.thesis || '',
      }],

      // 其他状态
      debateWinner: synthesis?.recommendation === 'buy' || synthesis?.recommendation === 'strong_buy' ? 'optimistic' :
                    synthesis?.recommendation === 'sell' || synthesis?.recommendation === 'reduce' ? 'pessimistic' : 'draw',
      debateSummary: synthesis?.summary || '',
    };

    return updates;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('DeepAgent node failed', { error: errorMessage });

    // 发送 agent_error 事件
    if (state.progressCallback) {
      state.progressCallback({
        type: 'agent_error',
        data: {
          agentId: 'deep-agent',
          error: errorMessage,
        },
      });
    }

    return {
      errors: [...(state.errors || []), `DeepAgent 错误: ${errorMessage}`],
    };
  }
};
