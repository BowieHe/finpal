import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  plannerNode, 
  parallelResearchNode, 
  deepCheckNode,
  extractJSONFromText,
  getContentString 
} from './nodes';
import type { GraphState } from './state';

// Mock dependencies
vi.mock('../llm/client', () => ({
  getLLMInstance: vi.fn(() => ({
    invoke: vi.fn(),
  })),
  withRetry: vi.fn((fn) => fn()),
}));

vi.mock('../search/qwen-mcp-websearch', () => ({
  parallelMCPWebSearch: vi.fn(),
}));

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('Graph Nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Utility Functions', () => {
    describe('getContentString', () => {
      it('should return string as-is', () => {
        expect(getContentString('test')).toBe('test');
      });

      it('should extract text from array', () => {
        expect(getContentString(['hello', 'world'])).toBe('helloworld');
      });

      it('should extract text from object with text property', () => {
        expect(getContentString({ text: 'hello' })).toBe('hello');
      });

      it('should return empty string for unknown types', () => {
        expect(getContentString(null)).toBe('');
        expect(getContentString(123)).toBe('');
      });
    });

    describe('extractJSONFromText', () => {
      it('should parse valid JSON', () => {
        const result = extractJSONFromText('{"key": "value"}');
        expect(result).toEqual({ key: 'value' });
      });

      it('should extract JSON from markdown code block', () => {
        const text = '```json\n{"key": "value"}\n```';
        const result = extractJSONFromText(text);
        expect(result).toEqual({ key: 'value' });
      });

      it('should return null for invalid JSON', () => {
        const result = extractJSONFromText('not json');
        expect(result).toBeNull();
      });
    });
  });

  describe('plannerNode', () => {
    it('should create sub-tasks from LLM response', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            subQueries: [
              { query: 'What is AI?', rationale: 'Basic definition' },
              { query: 'AI applications', rationale: 'Use cases' },
            ],
          }),
        }),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const state = {
        question: 'Tell me about AI',
        breadth: 2,
      } as unknown as GraphState;

      const result = await plannerNode(state);

      expect(result.researchPlan).toHaveLength(2);
      expect(result.subTasks).toHaveLength(2);
      expect(result.currentDepth).toBe(1);
      expect(result.subTasks![0].status).toBe('pending');
    });

    it('should handle LLM error and create fallback task', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockRejectedValue(new Error('LLM failed')),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const state = {
        question: 'Test question',
        breadth: 3,
      } as unknown as GraphState;

      const result = await plannerNode(state);

      expect(result.researchPlan).toHaveLength(1);
      expect(result.researchPlan![0]).toBe('Test question');
      expect(result.subTasks).toHaveLength(1);
    });
  });

  describe('parallelResearchNode', () => {
    it('should skip if no pending tasks', async () => {
      const state = {
        subTasks: [
          { id: '1', query: 'q1', status: 'completed', depth: 1 },
        ],
        allFindings: [],
      } as unknown as GraphState;

      const result = await parallelResearchNode(state);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should execute search for pending tasks', async () => {
      const { parallelMCPWebSearch } = await import('../search/qwen-mcp-websearch');
      (parallelMCPWebSearch as any).mockResolvedValue([
        {
          query: 'test1',
          results: [
            { title: 'Result 1', url: 'https://1.com', description: 'Desc 1' },
          ],
        },
        {
          query: 'test2',
          results: [
            { title: 'Result 2', url: 'https://2.com', description: 'Desc 2' },
          ],
        },
      ]);

      const state = {
        subTasks: [
          { id: '1', query: 'test1', status: 'pending', depth: 1 },
          { id: '2', query: 'test2', status: 'pending', depth: 1 },
        ],
        allFindings: [],
        currentDepth: 1,
      } as unknown as GraphState;

      const result = await parallelResearchNode(state);

      expect(result.allFindings).toHaveLength(2);
      expect(result.subTasks![0].status).toBe('completed');
      expect(result.subTasks![1].status).toBe('completed');
    });
  });

  describe('deepCheckNode', () => {
    it('should synthesize findings when max depth reached', async () => {
      const state = {
        currentDepth: 2,
        maxDepth: 2,
        allFindings: [
          { query: 'q1', content: 'content1', depth: 1, sources: ['https://1.com'] },
        ],
        question: 'Test',
      } as unknown as GraphState;

      const result = await deepCheckNode(state);

      expect(result.researchSummary).toBeDefined();
      expect(result.researchSummary!.key_facts).toHaveLength(1);
    });

    it('should create new tasks when shouldContinue is true', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            shouldContinue: true,
            reason: 'Need more depth',
            newAngles: ['Deep dive 1', 'Deep dive 2'],
          }),
        }),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const state = {
        currentDepth: 1,
        maxDepth: 2,
        allFindings: [
          { query: 'q1', content: 'content1', depth: 1, sources: ['https://1.com'] },
        ],
        subTasks: [
          { id: '1', query: 'q1', status: 'completed', depth: 1 },
        ],
      } as unknown as GraphState;

      const result = await deepCheckNode(state);

      expect(result.currentDepth).toBe(2);
      expect(result.subTasks).toHaveLength(3); // 1 completed + 2 new
    });

    it('should synthesize when shouldContinue is false', async () => {
      const { getLLMInstance } = await import('../llm/client');
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            shouldContinue: false,
            reason: 'Sufficient research',
            newAngles: [],
          }),
        }),
      };
      (getLLMInstance as any).mockReturnValue(mockLLM);

      const state = {
        currentDepth: 1,
        maxDepth: 2,
        allFindings: [
          { query: 'q1', content: 'content1', depth: 1, sources: ['https://1.com'] },
        ],
        question: 'Test',
      } as unknown as GraphState;

      const result = await deepCheckNode(state);

      expect(result.researchSummary).toBeDefined();
    });
  });
});
