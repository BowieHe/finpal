import { GraphState } from '../state';
import { AgentTask } from '../../agents/types';
import { createLogger } from '../../logger';
import { dbAgent } from '../../agents/db-agent';
import { webAgent } from '../../agents/web-agent';
import { quantAgent } from '../../agents/quant-agent';

const logger = createLogger('AgentAdapters');

/**
 * 带有索引信息的任务负载，由 Dispatcher 透传过来
 */
export interface DispatchPayload {
  taskIdx: number;
  taskDef: AgentTask;
}

/**
 * DB Agent Adapter
 */
export const dbAgentAdapter = async (state: GraphState & { payload: DispatchPayload }): Promise<Partial<GraphState>> => {
  const { taskIdx, taskDef } = state.payload;
  logger.info('Dispatched db-agent for task', { taskDef, taskIdx });

  if (state.progressCallback) {
    state.progressCallback({
        type: 'agent_start',
        data: { agentId: 'db-agent', taskDescription: `正在执行本地数据查询：${taskDef.task}` }
    });
  }

  const result = await dbAgent({
    task: taskDef.task as any,
    params: taskDef.params as any
  });

  if (state.progressCallback) {
    state.progressCallback({
        type: result.status === 'error' ? 'agent_error' : 'agent_done',
        data: { 
            agentId: 'db-agent', 
            summary: `查询完成：${taskDef.task}`,
            results: [result],
            error: result.error
        }
    });
  }

  const resultKey = `db-agent_${taskDef.task}_${taskIdx}`;
  
  return {
    collectedData: { [resultKey]: result }
  };
};

/**
 * Web Agent Adapter
 */
export const webAgentAdapter = async (state: GraphState & { payload: DispatchPayload }): Promise<Partial<GraphState>> => {
  const { taskIdx, taskDef } = state.payload;
  logger.info('Dispatched web-agent for task', { taskDef, taskIdx });

  if (state.progressCallback) {
    state.progressCallback({
        type: 'agent_start',
        data: { agentId: `web-agent-${taskIdx}`, taskDescription: `正在联网检索：${taskDef.task}` }
    });
  }

  const result = await webAgent({
    task: taskDef.task as any,
    params: taskDef.params as any
  });

  if (state.progressCallback) {
    state.progressCallback({
        type: result.status === 'error' ? 'agent_error' : 'agent_done',
        data: { 
            agentId: `web-agent-${taskIdx}`, 
            summary: `检索及摘要完成 (${result.durationMs}ms)`,
            results: [result],
            error: result.error
        }
    });
  }

  const resultKey = `web-agent_${taskDef.task}_${taskIdx}`;

  return {
    collectedData: { [resultKey]: result }
  };
};

/**
 * Quant Agent Adapter
 */
export const quantAgentAdapter = async (state: GraphState & { payload: DispatchPayload }): Promise<Partial<GraphState>> => {
    const { taskIdx, taskDef } = state.payload;
    logger.info('Dispatched quant-agent for task', { taskDef, taskIdx });
  
    if (state.progressCallback) {
      state.progressCallback({
          type: 'agent_start',
          data: { agentId: `quant-agent-${taskIdx}`, taskDescription: `正在执行量化计算` }
      });
    }
  
    const result = await quantAgent({
      fundCode: String(taskDef.params.fundCode || ''),
      priceHistory: taskDef.params.priceHistory as number[] || [],
      riskFreeRate: taskDef.params.riskFreeRate as number | undefined
    });
  
    if (state.progressCallback) {
      state.progressCallback({
          type: result.insufficientData ? 'agent_error' : 'agent_done',
          data: { 
              agentId: `quant-agent-${taskIdx}`, 
              summary: `量化计算完成 (${result.durationMs}ms)`,
              results: [result]
          }
      });
    }
  
    const resultKey = `quant-agent_risk_metrics_${taskIdx}`;
  
    return {
      collectedData: { [resultKey]: result }
    };
  };
