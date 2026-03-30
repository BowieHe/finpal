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

  // 用于累积所有 findings
  const allFindings: any[] = [];

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

        // 将 DeepAgent 的 eventDetail 透传给前端
        if (event.eventDetail) {
          state.progressCallback({
            type: 'timeline_event',
            data: event.eventDetail as any,
          });
        }

        // 处理搜索完成事件，累积 findings
        if (event.type === 'search_complete' && event.data?.searchResults) {
          const searchResults = event.data.searchResults;
          for (const result of searchResults) {
            if (result.query && result.results) {
              allFindings.push({
                query: result.query,
                content: result.results.map((r: any) =>
                  `${r.title}\n${r.description || r.snippet || ''}`
                ).join('\n\n'),
                sources: result.results.map((r: any) => r.url || r.link).filter(Boolean),
                depth: event.step || 0,
                engine: result.engine,
                timestamp: Date.now(),
              });
            }
          }
        }

        // 继续透传原始事件类型
        const directEvents = [
          'node_start',
          'searching',
          'search_result',
          'search_complete',
          'db_query',
          'db_result',
          'optimistic_output',
          'pessimistic_output',
          'optimistic_rebuttal',
          'pessimistic_rebuttal',
          'round_judge',
        ];
        if (directEvents.includes(event.type)) {
          const detail = event.eventDetail;
          const metadata = detail?.metadata || {};
          const forwardedData: Record<string, unknown> = {
            ...(event.data || {}),
          };

          if (metadata.query && !forwardedData.query) {
            forwardedData.query = metadata.query as string;
          }

          if (event.type === 'search_result' && Array.isArray(detail?.content) && !forwardedData.results) {
            forwardedData.results = detail.content;
          }

          state.progressCallback({
            type: event.type,
            data: forwardedData,
            message: event.message,
            step: event.step,
          } as any);
        }

        // agent_progress 事件
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
        allFindings,
      };
    }

    // 从 observations 中提取搜索数据
    const searchObservations = result.observations.filter(
      obs => obs.skillName === 'fund-deep-search' && obs.output.success
    );

    for (const obs of searchObservations) {
      const searchData = obs.output.data;
      if (searchData?.searchResults) {
        for (const sr of searchData.searchResults) {
          if (!allFindings.find(f => f.query === sr.query)) {
            allFindings.push({
              query: sr.query,
              content: sr.results?.map((r: any) =>
                `${r.title}\n${r.description || r.snippet || ''}`
              ).join('\n\n') || '',
              sources: sr.results?.map((r: any) => r.url || r.link).filter(Boolean) || [],
              depth: obs.step,
              engine: sr.engine,
              timestamp: obs.timestamp,
            });
          }
        }
      }
    }

    // 发送所有 findings
    if (state.progressCallback && allFindings.length > 0) {
      state.progressCallback({
        type: 'all_findings',
        data: { allFindings },
      });
    }

    // 检查是否是直接回答场景（没有 debate 数据，但有 thoughts 包含回答）
    const debateData = result.data;
    const hasDebateData = debateData && (debateData.bullCase || debateData.bearCase || debateData.synthesis);

    // 只有真正“未调用任何工具”的场景，才将其视为 direct answer
    const isTrueDirectAnswer =
      !hasDebateData &&
      result.thoughts.length > 0 &&
      result.actions.length === 0 &&
      result.observations.length === 0;

    if (isTrueDirectAnswer) {
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

        // 发送 agent_done 事件
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
            allFindings,
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
        allFindings,
      };
    }

    // 正常基金分析流程（有 debate 数据）
    const bullCase = debateData?.bullCase;
    const bearCase = debateData?.bearCase;
    const synthesis = debateData?.synthesis;
    const evCalculation = debateData?.evCalculation;

    const hasRoundStreaming = Array.isArray(debateData?.rounds) && debateData.rounds.length > 0;

    // 发送 optimistic_output 事件 (fallback，避免旧路径无输出)
    if (state.progressCallback && bullCase?.thesis && !hasRoundStreaming) {
      state.progressCallback({
        type: 'optimistic_output',
        data: {
          answer: bullCase.thesis,
          thinking: bullCase.catalysts?.join('\n') || '',
        },
      });
    }

    // 发送 pessimistic_output 事件 (fallback，避免旧路径无输出)
    if (state.progressCallback && bearCase?.thesis && !hasRoundStreaming) {
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
          allFindings,
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

      // 搜索 findings
      allFindings,

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

      // 辩论历史（优先使用多轮结果，避免覆盖流式轮次）
      debateHistory: Array.isArray(debateData?.rounds) && debateData.rounds.length > 0
        ? debateData.rounds.map((r: any) => ({
            round: r.round,
            optimisticAnswer: r.optimistic || '',
            pessimisticAnswer: r.pessimistic || '',
          }))
        : [{
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
      allFindings,
    };
  }
};
