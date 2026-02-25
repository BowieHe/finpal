import { StateGraph, START } from '@langchain/langgraph';
import { GraphAnnotation, GraphState } from './state';
import { optimisticNode, pessimisticNode } from './nodes';

export const createGraph = () => {
  const graph = new StateGraph({ annotation: GraphAnnotation })
    .addNode('optimistic', optimisticNode)
    .addNode('pessimistic', pessimisticNode)
    .addEdge(START, 'optimistic')
    .addEdge(START, 'pessimistic')
    .addEdge('optimistic', END)
    .addEdge('pessimistic', END);

  return graph.compile();
};

export const chatGraph = createGraph();
