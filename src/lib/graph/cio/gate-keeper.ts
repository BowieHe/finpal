import { GraphState } from '../state';
import { createLogger } from '../../logger';

const logger = createLogger('GateKeeper');

/**
 * Gate Keeper 节点
 * 负责在所有并行子 Agent 结束后，收集 collectedData，校验是否缺失数据。
 * 并根据 CIO plan 的要求决定后续路由：
 * - 报错
 * - 降级 (加 warning 放行)
 * - 正常放行
 */
export const gateKeeperNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  logger.info('Starting gate keeper check');
  
  if (state.progressCallback) {
    state.progressCallback({
      type: 'gate_keeper_check',
      data: { message: 'Gate Keeper 正在校验任务完成度...' }
    });
  }

  const plan = state.plan;
  const collectedData = state.collectedData || {};
  let newWarnings: string[] = [];
  let newErrors: string[] = [];
  
  if (!plan) {
    return { errors: ['未找到执行计划'] };
  }

  let failedCritical = false;

  for (let i = 0; i < plan.tasks.length; i++) {
    const task = plan.tasks[i];
    // 使用唯一的 task 键去 collectedData 里找 (在 adapter 中定义为 agent_task_idx)
    const resultKey = `${task.agent}_${task.task}_${i}`;
    const result = collectedData[resultKey];

    if (!result || result.status === 'error' || result.status === 'partial') {
      const msg = `任务 ${task.agent}(${task.task}) ${result?.status === 'partial' ? '部分完成' : '失败/未返回'}: ${result?.error || 'No result'}`;
      
      if (task.canSkip) {
        newWarnings.push(msg);
        logger.warn('Gate Keeper warning (skipped task)', { msg });
      } else {
        newErrors.push(`[致命] ${msg}`);
        logger.error('Gate Keeper error (critical task)', { msg });
        failedCritical = true;
      }
    }
  }

  if (state.progressCallback) {
    if (failedCritical) {
      state.progressCallback({
        type: 'gate_keeper_check',
        data: { message: '关键数据获取失败，流程中断。' }
      });
    } else if (newWarnings.length > 0) {
      state.progressCallback({
        type: 'gate_keeper_check',
        data: { message: '部分数据缺失，带警告继续。', results: newWarnings }
      });
    } else {
      state.progressCallback({
        type: 'gate_keeper_check',
        data: { message: '数据校验通过，数据完整。' }
      });
    }
  }

  return {
    warnings: newWarnings,
    errors: newErrors
  };
};

/**
 * Gate Keeper 的条件路由边函数
 * @param state 当前状态
 * @returns 要去往的节点名称
 */
export const gateKeeperRouter = (state: GraphState) => {
  const hasCriticalOmissions = state.errors && state.errors.some(e => e.includes('[致命]'));
  
  if (hasCriticalOmissions) {
    // 关键任务失败，不进辩论，直达结束
    logger.warn('Gate Keeper Route: Critical Failure -> END');
    return 'end_failure'; 
  }

  if (state.plan && !state.plan.requiresDebate) {
    // 短路流程：不辩论，直接让 Judge （或一个直接回答节点）总结出最终答案
    logger.info('Gate Keeper Route: No Debate -> direct_summary');
    return 'direct_summary';
  }

  // 默认进入完整的辩论环节 (这里连回原来的乐观派/悲观派分析)
  logger.info('Gate Keeper Route: Full Debate -> optimistic');
  return 'optimistic'; 
};
