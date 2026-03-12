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
import { dataSynthesizerNode } from './cio/data-synthesizer';
import { dbAgentAdapter, webAgentAdapter, quantAgentAdapter } from './nodes/agent-adapters';

/**
 * CIO 派发入口路由器
 * - 如果有任务：返回 Send[] 进入并行适配器
 * - 如果没任务：返回字符串 'gateKeeper' 直接进入分析状态
 */
const intentPlannerRouter = (state: GraphState): any => {
  const hasTasks = state.plan && state.plan.tasks && state.plan.tasks.length > 0;
  
  if (hasTasks) {
    return state.plan!.tasks.map((task, idx) => {
      return new Send(`adapter_${task.agent}`, {
        ...state,
        payload: { taskDef: task, taskIdx: idx }
      });
    });
  }

  return 'gateKeeper';
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
    .addNode('dataSynthesizer', dataSynthesizerNode)
    
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
    
    // 动态派发 (Fan-out or Skip)
    .addConditionalEdges('intentPlanner', intentPlannerRouter, [
      'adapter_db-agent',
      'adapter_web-agent',
      'adapter_quant-agent',
      'gateKeeper'
    ])
    
    // 收集所有并发 Agent 结果到 gateKeeper (Fan-in)
    .addEdge('adapter_db-agent', 'gateKeeper')
    .addEdge('adapter_web-agent', 'gateKeeper')
    .addEdge('adapter_quant-agent', 'gateKeeper')
    
    // gateKeeper 根据结果状态决定下一步路线
    .addConditionalEdges('gateKeeper', gateKeeperRouter, {
      optimistic: 'dataSynthesizer', // 辩论前先合成数据
      direct_summary: 'directSummary',
      planning_loop: 'intentPlanner',
      end_failure: END
    })
    
    // 合成完成后进入正式辩论
    .addEdge('dataSynthesizer', 'optimistic')
    
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
