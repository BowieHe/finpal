import { StateGraph, START, END } from '@langchain/langgraph';
import { GraphAnnotation } from './state';
import {
  researcherNode,
  optimisticInitialNode,
  pessimisticInitialNode,
  optimisticRebuttalNode,
  pessimisticRebuttalNode,
  deciderNode
} from './nodes';

/**
 * 创建辩论流程图
 * 流程: START → researcher → [optimistic || pessimistic] → optimisticRebuttal → pessimisticRebuttal → decider → END
 * 共 2 轮: 初始观点（并行执行） + 1 轮反驳 + 裁决
 *
 * 优化点：乐观派和悲观派初始分析并行执行，减少响应时间
 */
export const createGraph = () => {
  const graph = new StateGraph(GraphAnnotation)
    .addNode('researcher', researcherNode)
    .addNode('optimistic', optimisticInitialNode)
    .addNode('pessimistic', pessimisticInitialNode)
    .addNode('optimisticRebuttalNode', optimisticRebuttalNode)
    .addNode('pessimisticRebuttalNode', pessimisticRebuttalNode)
    .addNode('decider', deciderNode)
    .addEdge(START, 'researcher')
    // researcher 完成后，并行启动乐观和悲观节点
    .addEdge('researcher', 'optimistic')
    .addEdge('researcher', 'pessimistic')
    // 等待乐观和悲观都完成后，才执行反驳节点
    .addEdge('optimistic', 'optimisticRebuttalNode')
    .addEdge('pessimistic', 'optimisticRebuttalNode')
    .addEdge('optimisticRebuttalNode', 'pessimisticRebuttalNode')
    .addEdge('pessimisticRebuttalNode', 'decider')
    .addEdge('decider', END);

  return graph.compile();
};

export const chatGraph = createGraph();
