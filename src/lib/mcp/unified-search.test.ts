import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smartSearch, batchSearch } from './unified-search';
import type { SearchResult } from '@/types/mcp';

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    timed: vi.fn((name, fn) => fn()),
  }),
}));

vi.mock('./manager', () => ({
  mcpManager: {
    getClient: vi.fn(() => ({
      callTool: vi.fn(() => Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify([
          { title: 'Test Result', url: 'https://test.com', snippet: 'Test description' }
        ]) }]
      })),
    })),
  },
}));

describe('smartSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return search result with correct structure', async () => {
    const result = await smartSearch('test query');

    expect(result).toHaveProperty('query', 'test query');
    expect(result).toHaveProperty('engine');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('timestamp');
    expect(Array.isArray(result.results)).toBe(true);
  }, 10000);

  it('should handle MCP errors gracefully', async () => {
    const { mcpManager } = await import('./manager');
    vi.mocked(mcpManager.getClient).mockRejectedValueOnce(new Error('MCP Error'));

    const result = await smartSearch('test query');

    expect(result.error).toBe(true);
    expect(result.results).toEqual([]);
  }, 10000);
});

describe('batchSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process multiple queries', async () => {
    const results = await batchSearch(['query1', 'query2']);

    expect(results).toHaveLength(2);
    expect(results[0].query).toBe('query1');
    expect(results[1].query).toBe('query2');
  }, 15000);

  it('should return empty array for empty input', async () => {
    const results = await batchSearch([]);

    expect(results).toEqual([]);
  });
});
