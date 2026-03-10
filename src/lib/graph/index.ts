import { StateGraph, START, END } from '@langchain/langgraph';
import { GraphAnnotation } from './state';
import {
  researcherNode,
  optimisticInitialNode,
  pessimisticInitialNode,
  optimisticRebuttalNode,
  pessimisticRebuttalNode,
  deciderNode,
} from './nodes';

export const createGraph = () => {
  const graph = new StateGraph(GraphAnnotation)
    .addNode('researcher', researcherNode)
    .addNode('optimistic_initial', optimisticInitialNode)
    .addNode('pessimistic_initial', pessimisticInitialNode)
    .addNode('optimistic_rebuttal', optimisticRebuttalNode)
    .addNode('pessimistic_rebuttal', pessimisticRebuttalNode)
    .addNode('decider', deciderNode)
    
    .addEdge(START, 'researcher')
    .addEdge('researcher', 'optimistic_initial')
    .addEdge('researcher', 'pessimistic_initial')
    .addEdge('optimistic_initial', 'decider')
    .addEdge('pessimistic_initial', 'decider')
    .addConditionalEdges(
      'decider',
      (state) => state.shouldContinue && state.round < state.maxRounds ? 'continue' : 'end',
      {
        continue: 'optimistic_rebuttal',
        end: END,
      }
    )
    .addEdge('optimistic_rebuttal', 'pessimistic_rebuttal')
    .addEdge('pessimistic_rebuttal', 'decider');

  return graph.compile();
};

export const chatGraph = createGraph();
