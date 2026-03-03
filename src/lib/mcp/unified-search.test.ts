import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smartSearch, unifiedSearch, batchSearch, getSearchStats } from './unified-search';
import type { SearchResult, SearchEngine, QueryCategory } from '@/types/mcp';

// 模拟依赖
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

import { aliyunWebSearch } from '../search/aliyun-websearch';
import { classifyQuery, quickClassify } from '../search/query-classifier';

const mockAliyunWebSearch = vi.mocked(aliyunWebSearch);
const mockClassifyQuery = vi.mocked(classifyQuery);
const mockQuickClassify = vi.mocked(quickClassify);

describe('smartSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DASHSCOPE_API_KEY;
  });

  describe('阿里云搜索', () => {
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

      const result = await smartSearch('test query', { useLLM: false });

      expect(mockAliyunWebSearch).toHaveBeenCalledWith('test query');
      expect(result.engine).toBe('aliyun-websearch');
      expect(result.category).toBe('finance_news');
    });

    it('API Key 缺失时应返回错误', async () => {
      delete process.env.DASHSCOPE_API_KEY;
      mockQuickClassify.mockReturnValue('general');

      const result = await smartSearch('test query', { useLLM: false });

      expect(mockAliyunWebSearch).not.toHaveBeenCalled();
      expect(result.engine).toBe('aliyun-websearch');
      expect(result.error).toBe(true);
      expect(result.reasoning).toContain('DASHSCOPE_API_KEY');
      expect(result.results).toHaveLength(0);
    });

    it('搜索结果应包含分类信息', async () => {
      process.env.DASHSCOPE_API_KEY = 'test-key';
      mockAliyunWebSearch.mockResolvedValue({
        query: 'test query',
        engine: 'aliyun-websearch',
        results: [
          { title: 'Result 1', url: 'https://1.com', description: 'Desc 1', position: 1 },
          { title: 'Result 2', url: 'https://2.com', description: 'Desc 2', position: 2 },
        ],
        timestamp: Date.now(),
        reasoning: 'Aliyun result',
      });
      mockQuickClassify.mockReturnValue('academic');

      const result = await smartSearch('test query', { useLLM: false });

      expect(result.results).toHaveLength(2);
      expect(result.category).toBe('academic');
      expect(result.reasoning).toContain('[academic]');
    });
  });

  describe('查询分类', () => {
    it('使用 LLM 分类时应调用 classifyQuery', async () => {
      process.env.DASHSCOPE_API_KEY = 'test-key';
      mockClassifyQuery.mockResolvedValue({
        category: 'finance_data',
        confidence: 0.9,
        reasoning: 'Contains stock-related keywords',
      });
      mockAliyunWebSearch.mockResolvedValue({
        query: 'test',
        engine: 'aliyun-websearch',
        results: [],
        timestamp: Date.now(),
        reasoning: 'result',
      });

      await smartSearch('stock price', { useLLM: true });

      expect(mockClassifyQuery).toHaveBeenCalledWith('stock price');
    });

    it('禁用 LLM 时应使用 quickClassify', async () => {
      process.env.DASHSCOPE_API_KEY = 'test-key';
      mockQuickClassify.mockReturnValue('finance_news');
      mockAliyunWebSearch.mockResolvedValue({
        query: 'test',
        engine: 'aliyun-websearch',
        results: [],
        timestamp: Date.now(),
        reasoning: 'result',
      });

      await smartSearch('market news', { useLLM: false });

      expect(mockQuickClassify).toHaveBeenCalledWith('market news');
      expect(mockClassifyQuery).not.toHaveBeenCalled();
    });

    it('指定 category 时应跳过分类', async () => {
      process.env.DASHSCOPE_API_KEY = 'test-key';
      mockAliyunWebSearch.mockResolvedValue({
        query: 'test',
        engine: 'aliyun-websearch',
        results: [],
        timestamp: Date.now(),
        reasoning: 'result',
      });

      await smartSearch('query', { category: 'government', useLLM: false });

      expect(mockClassifyQuery).not.toHaveBeenCalled();
      expect(mockQuickClassify).not.toHaveBeenCalled();
      expect(mockAliyunWebSearch).toHaveBeenCalled();
    });
  });
});

describe('unifiedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = 'test-key';
  });

  it('应调用 smartSearch 并禁用 LLM', async () => {
    mockAliyunWebSearch.mockResolvedValue({
      query: 'test query',
      engine: 'aliyun-websearch',
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
    process.env.DASHSCOPE_API_KEY = 'test-key';
  });

  it('应串行处理多个查询', async () => {
    mockAliyunWebSearch
      .mockResolvedValueOnce({
        query: 'query1',
        engine: 'aliyun-websearch',
        results: [{ title: 'R1', url: 'https://1.com', description: 'D1', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'result1',
      })
      .mockResolvedValueOnce({
        query: 'query2',
        engine: 'aliyun-websearch',
        results: [{ title: 'R2', url: 'https://2.com', description: 'D2', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'result2',
      });
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

  it('部分搜索失败不应影响其他搜索', async () => {
    mockAliyunWebSearch
      .mockResolvedValueOnce({
        query: 'query1',
        engine: 'aliyun-websearch',
        results: [{ title: 'R1', url: 'https://1.com', description: 'D1', position: 1 }],
        timestamp: Date.now(),
        reasoning: 'result1',
      })
      .mockRejectedValueOnce(new Error('Search failed'));

    mockQuickClassify.mockReturnValue('general');

    // 由于 smartSearch 内部有 try-catch，这里需要验证行为
    const results = await batchSearch(['query1', 'query2']);

    expect(results).toHaveLength(2);
    expect(mockAliyunWebSearch).toHaveBeenCalledTimes(2);
  });
});

describe('getSearchStats', () => {
  it('应正确统计引擎使用情况', () => {
    const results: SearchResult[] = [
      { query: 'q1', engine: 'aliyun-websearch' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q2', engine: 'aliyun-websearch' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q3', engine: 'aliyun-websearch' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '' },
    ];

    const stats = getSearchStats(results);

    expect(stats.total).toBe(3);
    expect(stats.byEngine).toEqual({
      'aliyun-websearch': 3,
    });
  });

  it('应正确统计类别分布', () => {
    const results: SearchResult[] = [
      { query: 'q1', engine: 'aliyun-websearch' as SearchEngine, category: 'finance_news' as QueryCategory, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q2', engine: 'aliyun-websearch' as SearchEngine, category: 'finance_data' as QueryCategory, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q3', engine: 'aliyun-websearch' as SearchEngine, category: 'finance_news' as QueryCategory, results: [], timestamp: Date.now(), reasoning: '' },
    ];

    const stats = getSearchStats(results);

    expect(stats.byCategory).toEqual({
      finance_news: 2,
      finance_data: 1,
    });
  });

  it('应正确统计错误数量', () => {
    const results: SearchResult[] = [
      { query: 'q1', engine: 'aliyun-websearch' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '', error: true },
      { query: 'q2', engine: 'aliyun-websearch' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '' },
      { query: 'q3', engine: 'aliyun-websearch' as SearchEngine, results: [], timestamp: Date.now(), reasoning: '', error: true },
    ];

    const stats = getSearchStats(results);

    expect(stats.errors).toBe(2);
  });

  it('应正确统计总结果数', () => {
    const results: SearchResult[] = [
      { query: 'q1', engine: 'aliyun-websearch' as SearchEngine, results: [{ title: '1', url: '' }, { title: '2', url: '' }, { title: '3', url: '' }], timestamp: Date.now(), reasoning: '' },
      { query: 'q2', engine: 'aliyun-websearch' as SearchEngine, results: [{ title: '1', url: '' }, { title: '2', url: '' }], timestamp: Date.now(), reasoning: '' },
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
