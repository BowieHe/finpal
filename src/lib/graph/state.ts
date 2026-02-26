import { Annotation } from '@langchain/langgraph';

interface DataPoint {
  source: string;
  value: string;
  context: string;
}

interface ResearchSummary {
  summary: string;
  key_facts: string[];
  data_points: DataPoint[];
}

export const GraphAnnotation = Annotation.Root({
  question: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  
  searchResults: Annotation<any[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
  researchSummary: Annotation<ResearchSummary | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
  engineUsage: Annotation<Record<string, number>>({
    reducer: (prev, next) => next ?? prev,
    default: () => ({} as Record<string, number>),
  }),
  
  optimisticThinking: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  optimisticAnswer: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  optimisticRebuttal: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  
  pessimisticThinking: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  pessimisticAnswer: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  pessimisticRebuttal: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => '',
  }),
  
  shouldContinue: Annotation<boolean>({
    reducer: (prev, next) => next ?? prev,
    default: () => true,
  }),
  round: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 0,
  }),
  maxRounds: Annotation<number>({
    reducer: (prev, next) => next ?? prev,
    default: () => 5,
  }),
});

export type GraphState = typeof GraphAnnotation.State;
