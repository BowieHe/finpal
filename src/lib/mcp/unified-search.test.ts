import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smartSearch, unifiedSearch, batchSearch, getSearchStats, type SearchStrategy } from './unified-search';
import type { SearchResult, SearchEngine, QueryCategory } from '@/types/mcp';

// 模拟依赖
vi.mock('../mcp/manager', () => ({
  mcpManager: {
    getClient: vi.fn(),
  },
}));

vi.mock('../search/duckduckgo', () => ({
  duckDuckGoSearch: vi.fn(),
}));

vi.mock('../search/aliyun-websearch', () => ({
  aliyunWebSearch: vi.fn(),
}));

vi.mock('../search/query-classifier', () => ({
  classifyQuery: vi.fn(),
  quickClassify: vi.fn(),
}));

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    timed: vi.fn((name, fn) => fn()),
  }),
}));

import { mcpManager } from '../mcp/manager';
import { duckDuckGoSearch } from '../search/duckduckgo';
import { aliyunWebSearch } from '../search/aliyun-websearch';
import { classifyQuery, quickClassify } from '../search/query-classifier';

const mockMcpManager = vi.mocked(mcpManager);
const mockDuckDuckGoSearch = vi.mocked(duckDuckGoSearch);
const mockAliyunWebSearch = vi.mocked(aliyunWebSearch);
const mockClassifyQuery = vi.mocked(classifyQuery);
const mockQuickClassify = vi.mocked(quickClassify);

describe('smartSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DASHSCOPE_API_KEY;
  });

  describe('smart 策略', () => {
    it('MCP 成功时应直接使用 MCP 结果', async () => {
      const mockClient = {
        listTools: vi.fn().mockResolvedValue({
          tools: [{ name: 'web_search', description: 'Search the web' }],
        }),
        callTool: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                results: [{ title: 'Result', link: 'https://example.com', snippet: 'Desc' }],
              }),
            },
          ],
        }),
      };
      mockMcpManager.getClient.mockResolvedValue(mockClient as any);
      mockQuickClassify.mockReturnValue('general');

      const result = await smartSearch('test query', { strategy: 'smart', useLLM: false });

      expect(result.engine).toBe('open-websearch');
      expect(result.results).toHaveLength(1);
      expect(mockDuckDuckGoSearch).not.toHaveBeenCalled();
    });

    it('MCP 失败时应回退到 DuckDuckGo', async () => {
      mockMcpManager.getClient.mockRejectedValue(new Error('MCP failed'));
      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test query',
        engine: 'duckduckgo',
        results: [{ title: 'DDG Result', url: 'https://ddg.com', description: 'Desc', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'DuckDuckGo result',
      });
      mockQuickClassify.mockReturnValue('general');

      const result = await smartSearch('test query', { strategy: 'smart', useLLM: false });

      expect(result.engine).toBe('duckduckgo');
      expect(result.results[0].title).toBe('DDG Result');
      expect(mockDuckDuckGoSearch).toHaveBeenCalledWith('test query');
    });

    it('MCP 返回空结果时应回退到 DuckDuckGo', async () => {
      const mockClient = {
        listTools: vi.fn().mockResolvedValue({
          tools: [{ name: 'web_search' }],
        }),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ results: [] }) }],
        }),
      };
      mockMcpManager.getClient.mockResolvedValue(mockClient as any);
      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test query',
        engine: 'duckduckgo',
        results: [{ title: 'DDG Result', url: 'https://ddg.com', description: 'Desc', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'DuckDuckGo result',
      });
      mockQuickClassify.mockReturnValue('general');

      const result = await smartSearch('test query', { strategy: 'smart', useLLM: false });

      expect(mockDuckDuckGoSearch).toHaveBeenCalled();
    });
  });

  describe('aliyun-websearch 策略', () => {
    it('API Key 存在时应使用阿里云搜索', async () => {
      process.env.DASHSCOPE_API_KEY = 'test-key';
      mockAliyunWebSearch.mockResolvedValue({
        query: 'test query',
        engine: 'aliyun-websearch',
        results: [{ title: 'Aliyun Result', url: 'https://aliyun.com', description: 'Desc', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'Aliyun result',
      });
      mockQuickClassify.mockReturnValue('finance_news');

      const result = await smartSearch('test query', { strategy: 'aliyun-websearch', useLLM: false });

      expect(mockAliyunWebSearch).toHaveBeenCalledWith('test query');
      expect(result.engine).toBe('aliyun-websearch');
      expect(result.category).toBe('finance_news');
    });

    it('API Key 缺失时应回退到默认搜索', async () => {
      delete process.env.DASHSCOPE_API_KEY;

      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test query',
        engine: 'duckduckgo',
        results: [{ title: 'Fallback Result', url: 'https://ddg.com', description: 'Desc', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'Fallback result',
      });
      mockQuickClassify.mockReturnValue('general');

      const result = await smartSearch('test query', { strategy: 'aliyun-websearch', useLLM: false });

      expect(mockAliyunWebSearch).not.toHaveBeenCalled();
      expect(mockDuckDuckGoSearch).toHaveBeenCalledWith('test query');
      expect(result.engine).toBe('duckduckgo');
    });
  });

  describe('duckduckgo 策略', () => {
    it('应直接使用 DuckDuckGo 搜索', async () => {
      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test query',
        engine: 'duckduckgo',
        results: [{ title: 'DDG Result', url: 'https://ddg.com', description: 'Desc', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'DuckDuckGo result',
      });
      mockQuickClassify.mockReturnValue('encyclopedia');

      const result = await smartSearch('test query', { strategy: 'duckduckgo', useLLM: false });

      expect(mockDuckDuckGoSearch).toHaveBeenCalledWith('test query');
      expect(mockMcpManager.getClient).not.toHaveBeenCalled();
      expect(result.engine).toBe('duckduckgo');
      expect(result.category).toBe('encyclopedia');
    });
  });

  describe('open-websearch 策略', () => {
    it('MCP 成功时应返回 MCP 结果', async () => {
      const mockClient = {
        listTools: vi.fn().mockResolvedValue({
          tools: [{ name: 'web_search' }],
        }),
        callTool: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                results: [{ title: 'MCP Result', link: 'https://example.com', snippet: 'Desc' }],
              }),
            },
          ],
        }),
      };
      mockMcpManager.getClient.mockResolvedValue(mockClient as any);
      mockQuickClassify.mockReturnValue('academic');

      const result = await smartSearch('test query', { strategy: 'open-websearch', useLLM: false });

      expect(result.engine).toBe('open-websearch');
      expect(result.category).toBe('academic');
    });

    it('MCP 失败时应回退到 DuckDuckGo', async () => {
      mockMcpManager.getClient.mockRejectedValue(new Error('Connection failed'));
      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test query',
        engine: 'duckduckgo',
        results: [{ title: 'Fallback', url: 'https://ddg.com', description: 'Desc', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'Fallback result',
      });
      mockQuickClassify.mockReturnValue('general');

      const result = await smartSearch('test query', { strategy: 'open-websearch', useLLM: false });

      expect(result.engine).toBe('duckduckgo');
      expect(result.reasoning).toContain('fallback');
    });
  });

  describe('查询分类', () => {
    it('使用 LLM 分类时应调用 classifyQuery', async () => {
      mockClassifyQuery.mockResolvedValue({
        category: 'finance_data',
        confidence: 'high',
        reasoning: 'Contains stock-related keywords',
      });

      const mockClient = {
        listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'web_search' }] }),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ results: [] }) }],
        }),
      };
      mockMcpManager.getClient.mockResolvedValue(mockClient as any);
      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test',
        engine: 'duckduckgo',
        results: [],
        timestamp: Date.now(),
        reasoning: 'result',
      });

      await smartSearch('stock price', { useLLM: true, strategy: 'smart' });

      expect(mockClassifyQuery).toHaveBeenCalledWith('stock price');
    });

    it('禁用 LLM 时应使用 quickClassify', async () => {
      mockQuickClassify.mockReturnValue('finance_news');

      const mockClient = {
        listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'web_search' }] }),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ results: [] }) }],
        }),
      };
      mockMcpManager.getClient.mockResolvedValue(mockClient as any);
      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test',
        engine: 'duckduckgo',
        results: [],
        timestamp: Date.now(),
        reasoning: 'result',
      });

      await smartSearch('market news', { useLLM: false, strategy: 'smart' });

      expect(mockQuickClassify).toHaveBeenCalledWith('market news');
      expect(mockClassifyQuery).not.toHaveBeenCalled();
    });

    it('指定 category 时应跳过分类', async () => {
      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test',
        engine: 'duckduckgo',
        results: [],
        timestamp: Date.now(),
        reasoning: 'result',
      });

      await smartSearch('query', { category: 'government', strategy: 'duckduckgo', useLLM: false });

      expect(mockClassifyQuery).not.toHaveBeenCalled();
      expect(mockQuickClassify).not.toHaveBeenCalled();
    });
  });

  describe('默认策略', () => {
    it('未指定策略时应使用环境变量默认值', async () => {
      process.env.DEFAULT_SEARCH_ENGINE = 'duckduckgo' as SearchStrategy;

      mockDuckDuckGoSearch.mockResolvedValue({
        query: 'test',
        engine: 'duckduckgo',
        results: [],
        timestamp: Date.now(),
        reasoning: 'result',
      });
      mockQuickClassify.mockReturnValue('general');

      await smartSearch('query', { useLLM: false });

      expect(mockDuckDuckGoSearch).toHaveBeenCalled();

      delete process.env.DEFAULT_SEARCH_ENGINE;
    });
  });
});

describe('unifiedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应调用 smartSearch 并禁用 LLM', async () => {
    mockDuckDuckGoSearch.mockResolvedValue({
      query: 'test query',
      engine: 'duckduckgo',
      results: [],
      timestamp: Date.now(),
      reasoning: 'result',
    });
    mockQuickClassify.mockReturnValue('general');

    const result = await unifiedSearch('test query');

    expect(result.query).toBe('test query');
    expect(mockQuickClassify).toHaveBeenCalled();
    expect(mockClassifyQuery).not.toHaveBeenCalled();
  });
});

describe('batchSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应串行处理多个查询', async () => {
    mockDuckDuckGoSearch
      .mockResolvedValueOnce({
        query: 'query1',
        engine: 'duckduckgo',
        results: [{ title: 'R1', url: 'https://1.com', description: 'D1', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'result1',
      })
      .mockResolvedValueOnce({
        query: 'query2',
        engine: 'duckduckgo',
        results: [{ title: 'R2', url: 'https://2.com', description: 'D2', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'result2',
      });

    const mockClient = {
      listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'web_search' }] }),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ results: [] }) }],
      }),
    };
    mockMcpManager.getClient.mockResolvedValue(mockClient as any);
    mockQuickClassify.mockReturnValue('general');

    const results = await batchSearch(['query1', 'query2']);

    expect(results).toHaveLength(2);
    expect(results[0].query).toBe('query1');
    expect(results[1].query).toBe('query2');
  });

  it('空数组应返回空结果', async () => {
    const results = await batchSearch([]);

    expect(results).toEqual([]);
  });
});

describe('getSearchStats', () => {
  it('应正确统计引擎使用情况', () => {
    const results: SearchResult[] = [
      { query: 'q1', engine: 'duckduckgo' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q2', engine: 'duckduckgo' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q3', engine: 'aliyun-websearch' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '' },
    ];

    const stats = getSearchStats(results);

    expect(stats.total).toBe(3);
    expect(stats.byEngine).toEqual({
      duckduckgo: 2,
      'aliyun-websearch': 1,
    });
  });

  it('应正确统计类别分布', () => {
    const results: SearchResult[] = [
      { query: 'q1', engine: 'duckduckgo' as SearchEngine, category: 'finance_news' as QueryCategory, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q2', engine: 'duckduckgo' as SearchEngine, category: 'finance_data' as QueryCategory, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q3', engine: 'duckduckgo' as SearchEngine, category: 'finance_news' as QueryCategory, results: [], timestamp: Date.now(), reasoning: '' },
    ];

    const stats = getSearchStats(results);

    expect(stats.byCategory).toEqual({
      finance_news: 2,
      finance_data: 1,
    });
  });

  it('应正确统计错误数量', () => {
    const results: SearchResult[] = [
      { query: 'q1', engine: 'duckduckgo' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '', error: true },
      { query: 'q2', engine: 'duckduckgo' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q3', engine: 'duckduckgo' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '', error: true },
    ];

    const stats = getSearchStats(results);

    expect(stats.errors).toBe(2);
  });

  it('应正确统计总结果数', () => {
    const results: SearchResult[] = [
      { query: 'q1', engine: 'duckduckgo' as SearchEngine, results: [{ title: '1', url: '' }, { title: '2', url: '' }, { title: '3', url: '' }], timestamp: Date.now(), reasoning: '' },
      { query: 'q2', engine: 'duckduckgo' as SearchEngine, results: [{ title: '1', url: '' }, { title: '2', url: '' }], timestamp: Date.now(), reasoning: '' },
    ];

    const stats = getSearchStats(results);

    expect(stats.totalResults).toBe(5);
  });

  it('空数组应返回零值统计', () => {
    const stats = getSearchStats([]);

    expect(stats.total).toBe(0);
    expect(stats.byEngine).toEqual({});
    expect(stats.byCategory).toEqual({});
    expect(stats.totalResults).toBe(0);
    expect(stats.errors).toBe(0);
  });
});
