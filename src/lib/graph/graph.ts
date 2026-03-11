import { StateGraph, START, END, Send } from '@langchain/langgraph';
import { GraphAnnotation, GraphState } from './state';
import {
  optimisticInitialNode,
  pessimisticInitialNode,
  optimisticRebuttalNode,
  pessimisticRebuttalNode,
  roundJudgeNode,
  finalVerdictNode,
} from './nodes';

import { intentPlannerNode } from './cio/intent-planner';
import { gateKeeperNode, gateKeeperRouter } from './cio/gate-keeper';
import { directSummaryNode } from './cio/direct-summary';
import { dbAgentAdapter, webAgentAdapter, quantAgentAdapter } from './nodes/agent-adapters';

/**
 * CIO 动态派发逻辑
 */
const dispatchTasks = (state: GraphState): Send[] => {
  if (!state.plan || !state.plan.tasks) return [];
  
  return state.plan.tasks.map((task, idx) => {
    return new Send(`adapter_${task.agent}`, {
      ...state,
      payload: { taskDef: task, taskIdx: idx }
    });
  });
};

/**
 * 辩论循环路由：roundJudge 之后决定继续辩论还是生成最终报告
 * - shouldContinue=true AND round < maxRounds → 反驳轮（rebuttal）
 * - 否则 → 最终裁决报告（finalVerdict）
 */
const debateLoopRouter = (state: GraphState): 'rebuttal' | 'finalVerdict' => {
  const shouldLoop = state.shouldContinue && state.round < state.maxRounds;
  return shouldLoop ? 'rebuttal' : 'finalVerdict';
};

/**
 * 创建标准辩论流程图 (v3.2 - 辩论循环架构)
 *
 * 流程（辩论路线）：
 *   optimistic → pessimistic → roundJudge ─→ (rebuttal if continue)
 *                                          ↑         ↓
 *                                          └─────────┘ (loop)
 *                                          │
 *                                          └─→ finalVerdict → END
 */
export const createStandardGraph = () => {
  const graph = new StateGraph(GraphAnnotation)
    // CIO Nodes
    .addNode('intentPlanner', intentPlannerNode)
    .addNode('gateKeeper', gateKeeperNode)
    .addNode('directSummary', directSummaryNode)
    
    // Agent Adapters
    .addNode('adapter_db-agent', dbAgentAdapter)
    .addNode('adapter_web-agent', webAgentAdapter)
    .addNode('adapter_quant-agent', quantAgentAdapter)
    
    // Debate Nodes (Round 1 initial + rebuttal for subsequent rounds)
    .addNode('optimistic', optimisticInitialNode)
    .addNode('pessimistic', pessimisticInitialNode)
    .addNode('optimisticRebuttalNode', optimisticRebuttalNode)
    .addNode('pessimisticRebuttalNode', pessimisticRebuttalNode)
    
    // Judge & Verdict
    .addNode('roundJudge', roundJudgeNode)
    .addNode('finalVerdict', finalVerdictNode)
    
    // ===== Graph Wiring =====
    .addEdge(START, 'intentPlanner')
    
    // 动态派发 (Fan-out)
    .addConditionalEdges('intentPlanner', dispatchTasks)
    
    // 收集所有并发 Agent 结果到 gateKeeper (Fan-in)
    .addEdge('adapter_db-agent', 'gateKeeper')
    .addEdge('adapter_web-agent', 'gateKeeper')
    .addEdge('adapter_quant-agent', 'gateKeeper')
    
    // gateKeeper 根据结果状态决定下一步路线
    .addConditionalEdges('gateKeeper', gateKeeperRouter, {
      optimistic: 'optimistic',
      direct_summary: 'directSummary',
      end_failure: END
    })
    
    // 非辩论路线：直接生成总结
    .addEdge('directSummary', END)
    
    // === 辩论路线 Round 1：初始立场 ===
    .addEdge('optimistic', 'pessimistic')
    .addEdge('pessimistic', 'roundJudge')
    
    // === roundJudge 条件循环边 ===
    .addConditionalEdges('roundJudge', debateLoopRouter, {
      rebuttal: 'optimisticRebuttalNode',
      finalVerdict: 'finalVerdict',
    })
    
    // === 反驳轮完成后回到 roundJudge（循环） ===
    .addEdge('optimisticRebuttalNode', 'pessimisticRebuttalNode')
    .addEdge('pessimisticRebuttalNode', 'roundJudge')
    
    // === 最终裁决 → END ===
    .addEdge('finalVerdict', END);

  return graph.compile();
};

export const createGraph = () => {
  return createStandardGraph();
};

/**
 * 默认使用标准图
 */
export const chatGraph = createStandardGraph();
