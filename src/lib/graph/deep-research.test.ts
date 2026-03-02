import { describe, it, expect, vi, beforeEach } from 'vitest';
import { plannerNode, parallelResearchNode, deepCheckNode } from './nodes';
import type { GraphState } from './state';

// Mock dependencies
vi.mock('../search/qwen-mcp-websearch', () => ({
  parallelMCPWebSearch: vi.fn(),
}));

vi.mock('../llm/client', () => ({
  getLLMInstance: vi.fn(() => ({
    invoke: vi.fn(),
  })),
  withRetry: vi.fn((fn) => fn()),
}));

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('Deep Research Nodes', () => {
  let baseState: GraphState;

  beforeEach(() => {
    baseState = {
      question: 'Test question',
      searchStrategy: 'smart',
      deepResearchEnabled: true,
      currentDepth: 0,
      maxDepth: 2,
      breadth: 3,
      subTasks: [],
      allFindings: [],
      researchPlan: [],
      searchResults: [],
      researchSummary: null,
      engineUsage: {},
      optimisticThinking: '',
      optimisticAnswer: '',
      optimisticRebuttal: '',
      pessimisticThinking: '',
      pessimisticAnswer: '',
      pessimisticRebuttal: '',
      shouldContinue: false,
      round: 0,
      maxRounds: 2,
      debateWinner: 'draw',
      debateSummary: '',
    };
  });

  describe('plannerNode', () => {
    it('should create subtasks from LLM response', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            subQueries: [
              { query: 'Sub question 1', rationale: 'Why 1' },
              { query: 'Sub question 2', rationale: 'Why 2' },
            ],
          }),
        }),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const result = await plannerNode(baseState);

      expect(result.researchPlan).toHaveLength(2);
      expect(result.subTasks).toHaveLength(2);
      expect(result.currentDepth).toBe(1);
      expect(result.subTasks?.[0].status).toBe('pending');
    });

    it('should handle LLM error gracefully', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockRejectedValue(new Error('LLM failed')),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const result = await plannerNode(baseState);

      expect(result.researchPlan).toHaveLength(1);
      expect(result.researchPlan?.[0]).toBe('Test question');
      expect(result.subTasks).toHaveLength(1);
    });

    it('should use fallback for invalid JSON response', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: 'Invalid JSON',
        }),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const result = await plannerNode(baseState);

      expect(result.researchPlan).toHaveLength(1);
      expect(result.researchPlan?.[0]).toBe('Test question');
    });
  });

  describe('parallelResearchNode', () => {
    it('should skip if no pending tasks', async () => {
      const result = await parallelResearchNode(baseState);

      expect(result).toEqual({});
    });

    it('should execute search for pending tasks', async () => {
      const { parallelMCPWebSearch } = await import('../search/qwen-mcp-websearch');
      (parallelMCPWebSearch as any).mockResolvedValue([
        {
          query: 'Task 1',
          results: [
            { title: 'Result 1', url: 'https://1.com', description: 'Desc 1' },
          ],
          total: 1,
          duration: 100,
          timestamp: Date.now(),
        },
        {
          query: 'Task 2',
          results: [
            { title: 'Result 2', url: 'https://2.com', description: 'Desc 2' },
          ],
          total: 1,
          duration: 100,
          timestamp: Date.now(),
        },
      ]);

      const stateWithTasks = {
        ...baseState,
        subTasks: [
          { id: '1', query: 'Task 1', depth: 1, status: 'pending' as const },
          { id: '2', query: 'Task 2', depth: 1, status: 'pending' as const },
        ],
      };

      const result = await parallelResearchNode(stateWithTasks);

      expect(result.subTasks).toHaveLength(2);
      expect(result.subTasks?.[0].status).toBe('completed');
      expect(result.allFindings).toHaveLength(2);
      expect(parallelMCPWebSearch).toHaveBeenCalledWith(['Task 1', 'Task 2'], { topN: 5, recencyDays: 30 });
    });

    it('should mark tasks as failed on error', async () => {
      const { parallelMCPWebSearch } = await import('../search/qwen-mcp-websearch');
      (parallelMCPWebSearch as any).mockRejectedValue(new Error('Search failed'));

      const stateWithTasks = {
        ...baseState,
        subTasks: [
          { id: '1', query: 'Task 1', depth: 1, status: 'pending' as const },
        ],
      };

      const result = await parallelResearchNode(stateWithTasks);

      expect(result.subTasks?.[0].status).toBe('failed');
    });
  });

  describe('deepCheckNode', () => {
    it('should synthesize when max depth reached', async () => {
      const stateAtMaxDepth = {
        ...baseState,
        currentDepth: 2,
        maxDepth: 2,
        allFindings: [
          { query: 'Q1', content: 'Content 1', depth: 1, sources: ['https://1.com'] },
        ],
      };

      const result = await deepCheckNode(stateAtMaxDepth);

      expect(result.researchSummary).toBeDefined();
      expect(result.researchSummary?.key_facts).toHaveLength(1);
    });

    it('should synthesize when no findings', async () => {
      const result = await deepCheckNode(baseState);

      expect(result.researchSummary).toBeDefined();
      expect(result.researchSummary?.summary).toContain('未获取到');
    });

    it('should create new tasks when shouldContinue is true', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            shouldContinue: true,
            reason: 'Need more research',
            newAngles: ['Angle 1', 'Angle 2'],
          }),
        }),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const stateWithFindings = {
        ...baseState,
        currentDepth: 1,
        allFindings: [
          { query: 'Q1', content: 'Content 1', depth: 1, sources: ['https://1.com'] },
        ],
      };

      const result = await deepCheckNode(stateWithFindings);

      expect(result.currentDepth).toBe(2);
      expect(result.subTasks).toHaveLength(2);
    });

    it('should synthesize when shouldContinue is false', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            shouldContinue: false,
            reason: 'Enough research',
            newAngles: [],
          }),
        }),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const stateWithFindings = {
        ...baseState,
        currentDepth: 1,
        allFindings: [
          { query: 'Q1', content: 'Content 1', depth: 1, sources: ['https://1.com'] },
        ],
      };

      const result = await deepCheckNode(stateWithFindings);

      expect(result.researchSummary).toBeDefined();
    });

    it('should handle LLM error gracefully', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockRejectedValue(new Error('LLM error')),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const stateWithFindings = {
        ...baseState,
        currentDepth: 1,
        allFindings: [
          { query: 'Q1', content: 'Content 1', depth: 1, sources: ['https://1.com'] },
        ],
      };

      const result = await deepCheckNode(stateWithFindings);

      expect(result.researchSummary).toBeDefined();
    });
  });
});
