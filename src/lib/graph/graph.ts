/**
 * DeepAgent Graph - 极简版
 *
 * 移除所有旧版流程，只保留 DeepAgent
 * START → deepAgent → finalVerdict → END
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import { GraphAnnotation } from './state';
import { deepAgentNode } from './nodes/deep-agent-node';
import { finalVerdictNode } from './nodes/final-verdict-node';

/**
 * 创建 DeepAgent Graph
 *
 * 简化流程：
 * 1. DeepAgent 节点：完成所有研究、分析、辩论
 * 2. FinalVerdict 节点：格式化输出
 */
export const createGraph = () => {
  const graph = new StateGraph(GraphAnnotation)
    .addNode('deepAgent', deepAgentNode)
    .addNode('finalVerdict', finalVerdictNode)
    .addEdge(START, 'deepAgent')
    .addEdge('deepAgent', 'finalVerdict')
    .addEdge('finalVerdict', END);

  return graph.compile();
};

/**
 * 预编译的 Graph 实例（向后兼容）
 */
export const chatGraph = createGraph();

/**
 * 向后兼容的导出
 */
export const createStandardGraph = createGraph;
export const createSmartGraph = createGraph;
export const createDeepAgentOnlyGraph = createGraph;
export const smartGraph = chatGraph;
export const deepAgentOnlyGraph = chatGraph;
