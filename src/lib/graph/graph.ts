import { StateGraph, START, END } from '@langchain/langgraph';
import { GraphAnnotation } from './state';
import { optimisticInitialNode, pessimisticInitialNode, optimisticRebuttalNode, pessimisticRebuttalNode, deciderNode } from './nodes';

export const createGraph = () => {
  const graph = new StateGraph(GraphAnnotation)
    .addNode('optimistic', optimisticInitialNode)
    .addNode('pessimistic', pessimisticInitialNode)
    .addEdge(START, 'optimistic')
    .addEdge('optimistic', 'pessimistic')
    .addEdge('pessimistic', END);

  return graph.compile();
};

export const chatGraph = createGraph();
