import { GraphState } from './state';
import { llm } from '../llm/client';
import { OPTIMISTIC_PROMPT, PESSIMISTIC_PROMPT } from '../prompts';

export const optimisticNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const prompt = `${OPTIMISTIC_PROMPT}\n\n问题: ${state.question}\n\n请回答:`;
  const response = await llm.invoke(prompt);
  return {
    optimisticAnswer: response.content as string,
  };
};

export const pessimisticNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  const prompt = `${PESSIMISTIC_PROMPT}\n\n问题: ${state.question}\n\n请回答:`;
  const response = await llm.invoke(prompt);
  return {
    pessimisticAnswer: response.content as string,
  };
};
