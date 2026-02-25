import { Annotation } from '@langchain/langgraph';

export const GraphAnnotation = Annotation.Root({
  question: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  optimisticAnswer: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  pessimisticAnswer: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
});

export type GraphState = typeof GraphAnnotation.State;
