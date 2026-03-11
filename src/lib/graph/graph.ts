import { StateGraph, START, END, Send } from '@langchain/langgraph';
import { GraphAnnotation, GraphState } from './state';
import {
  optimisticInitialNode,
  pessimisticInitialNode,
  optimisticRebuttalNode,
  pessimisticRebuttalNode,
  deciderNode,
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
 * 创建标准辩论流程图 (v3.1 CIO 架构)
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
    
    // Debate Nodes
    .addNode('optimistic', optimisticInitialNode)
    .addNode('pessimistic', pessimisticInitialNode)
    .addNode('optimisticRebuttalNode', optimisticRebuttalNode)
    .addNode('pessimisticRebuttalNode', pessimisticRebuttalNode)
    .addNode('decider', deciderNode)
    
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
    
    // 如果不辩论，直接生成总结
    .addEdge('directSummary', END)
    
    // 辩论路线
    .addEdge('optimistic', 'pessimistic')
    .addEdge('pessimistic', 'optimisticRebuttalNode')
    .addEdge('optimisticRebuttalNode', 'pessimisticRebuttalNode')
    .addEdge('pessimisticRebuttalNode', 'decider')
    .addEdge('decider', END);

  return graph.compile();
};

export const createGraph = () => {
  return createStandardGraph();
};

/**
 * 默认使用标准图
 */
export const chatGraph = createStandardGraph();
