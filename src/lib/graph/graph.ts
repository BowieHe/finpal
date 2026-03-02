import { StateGraph, START, END } from '@langchain/langgraph';
import { GraphAnnotation } from './state';
import {
  researcherNode,
  optimisticInitialNode,
  pessimisticInitialNode,
  optimisticRebuttalNode,
  pessimisticRebuttalNode,
  deciderNode,
  plannerNode,
  parallelResearchNode,
  deepCheckNode,
} from './nodes';

/**
 * 创建标准辩论流程图
 */
export const createStandardGraph = () => {
  const graph = new StateGraph(GraphAnnotation)
    .addNode('researcher', researcherNode)
    .addNode('optimistic', optimisticInitialNode)
    .addNode('pessimistic', pessimisticInitialNode)
    .addNode('optimisticRebuttalNode', optimisticRebuttalNode)
    .addNode('pessimisticRebuttalNode', pessimisticRebuttalNode)
    .addNode('decider', deciderNode)
    .addEdge(START, 'researcher')
    .addEdge('researcher', 'optimistic')
    .addEdge('researcher', 'pessimistic')
    .addEdge('optimistic', 'optimisticRebuttalNode')
    .addEdge('pessimistic', 'optimisticRebuttalNode')
    .addEdge('optimisticRebuttalNode', 'pessimisticRebuttalNode')
    .addEdge('pessimisticRebuttalNode', 'decider')
    .addEdge('decider', END);

  return graph.compile();
};

/**
 * 创建 Deep Research 流程图
 */
export const createDeepResearchGraph = () => {
  const graph = new StateGraph(GraphAnnotation)
    .addNode('planner', plannerNode)
    .addNode('parallelResearch', parallelResearchNode)
    .addNode('deepCheck', deepCheckNode)
    .addNode('optimistic', optimisticInitialNode)
    .addNode('pessimistic', pessimisticInitialNode)
    .addNode('optimisticRebuttalNode', optimisticRebuttalNode)
    .addNode('pessimisticRebuttalNode', pessimisticRebuttalNode)
    .addNode('decider', deciderNode);

  // Deep Research 流程
  graph.addEdge(START, 'planner');
  graph.addEdge('planner', 'parallelResearch');
  graph.addEdge('parallelResearch', 'deepCheck');

  // 条件边：deepCheck 决定是否继续研究或进入双人格分析
  graph.addConditionalEdges(
    'deepCheck',
    (state) => state.researchSummary ? 'research_complete' : 'continue_research',
    { research_complete: 'optimistic', continue_research: 'parallelResearch' }
  );

  // 双人格流程
  graph.addEdge('optimistic', 'pessimistic');
  graph.addEdge('pessimistic', 'optimisticRebuttalNode');
  graph.addEdge('optimisticRebuttalNode', 'pessimisticRebuttalNode');
  graph.addEdge('pessimisticRebuttalNode', 'decider');
  graph.addEdge('decider', END);

  return graph.compile();
};

/**
 * 根据配置创建对应的图
 */
export const createGraph = (options?: { deepResearch?: boolean }) => {
  if (options?.deepResearch) return createDeepResearchGraph();
  return createStandardGraph();
};

/**
 * 默认使用标准图
 */
export const chatGraph = createStandardGraph();
