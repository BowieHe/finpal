import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webAgent } from './web-agent';
import { smartSearch } from '../mcp/unified-search';

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('../mcp/unified-search', () => ({
  smartSearch: vi.fn(),
}));

vi.mock('../mcp/manager', () => ({
  mcpManager: {
    getClient: vi.fn(),
  },
}));

describe('Web-Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return success and parse results', async () => {
    vi.mocked(smartSearch).mockResolvedValueOnce({
      query: '000001',
      engine: 'tavily' as any,
      timestamp: Date.now(),
      reasoning: 'Searched via mock',
      results: [
        { title: 'Result 1', url: 'https://test1.com', content: 'content1', description: 'desc1' },
      ],
      error: false
    });

    const result = await webAgent({
      task: 'fund_info',
      params: { fundCode: '000001', query: '' }
    });

    expect(result.status).toBe('success');
    expect(result.sources).toContain('https://test1.com');
    expect(result.sources.length).not.toBe(0);
    expect(result.fundCode).toBe('000001');
    expect(result.summary).toContain('Result 1');
    expect(result.rawSnippets[0].content).toContain('desc1');
  });

  it('should return partial when results are empty', async () => {
    vi.mocked(smartSearch).mockResolvedValueOnce({
      query: '000001',
      engine: 'tavily' as any,
      timestamp: Date.now(),
      reasoning: 'No results found',
      results: [],
      error: false
    });

    const result = await webAgent({
      task: 'fund_info',
      params: { fundCode: '000001', query: '' }
    });

    expect(result.status).toBe('partial');
    expect(result.error).toBe('No results found');
    expect(result.sources.length).toBe(0);
  });

  it('should handle search API errors', async () => {
    vi.mocked(smartSearch).mockRejectedValueOnce(new Error('Network error'));

    const result = await webAgent({
      task: 'fund_info',
      params: { query: 'test' }
    });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/Network error/);
  });

  it('should handle fetch_page task via playwright MCP', async () => {
    const mockClient = {
      callTool: vi.fn()
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Navigated' }] }) // navigate
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Full page content' }] }) // get_content
    };
    
    const { mcpManager } = await import('../mcp/manager');
    vi.mocked(mcpManager.getClient).mockResolvedValueOnce(mockClient as any);

    const result = await webAgent({
      task: 'fetch_page',
      params: { url: 'https://example.com' }
    });

    expect(result.status).toBe('success');
    expect(result.sources).toContain('https://example.com');
    expect(result.summary).toContain('Full page content');
    expect(result.rawSnippets[0].content).toBe('Full page content');
  });

  it('should fail on unknown task', async () => {
    const result = await webAgent({
      task: 'unknown_task' as any,
      params: { query: 'test' }
    });

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/Unknown Web-Agent task/);
  });
});
