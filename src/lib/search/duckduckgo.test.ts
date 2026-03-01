import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { duckDuckGoSearch, duckDuckGoBatchSearch } from './duckduckgo';
import * as duckDuckScrape from 'duck-duck-scrape';

// 模拟 logger
vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// 模拟 duck-duck-scrape
vi.mock('duck-duck-scrape', () => ({
  search: vi.fn(),
}));

describe('duckDuckGoSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('成功搜索', () => {
    it('应正确解析并返回搜索结果', async () => {
      const mockResults = {
        results: [
          {
            title: 'Test Result 1',
            url: 'https://example.com/1',
            description: 'Description 1',
          },
          {
            title: 'Test Result 2',
            url: 'https://example.com/2',
            description: 'Description 2',
          },
        ],
      };

      vi.mocked(duckDuckScrape.search).mockResolvedValueOnce(mockResults as any);

      const result = await duckDuckGoSearch('test query');

      expect(result.engine).toBe('duckduckgo');
      expect(result.query).toBe('test query');
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        title: 'Test Result 1',
        url: 'https://example.com/1',
        description: 'Description 1',
        position: 1,
      });
      expect(result.results[1]).toEqual({
        title: 'Test Result 2',
        url: 'https://example.com/2',
        description: 'Description 2',
        position: 2,
      });
      expect(result.reasoning).toContain('找到 2 条结果');
      expect(result.duration).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('应使用 safeSearch 参数 0', async () => {
      vi.mocked(duckDuckScrape.search).mockResolvedValueOnce({ results: [] } as any);

      await duckDuckGoSearch('test');

      expect(duckDuckScrape.search).toHaveBeenCalledWith('test', {
        safeSearch: 0,
      });
    });

    it('空搜索结果应返回空数组', async () => {
      vi.mocked(duckDuckScrape.search).mockResolvedValueOnce({ results: [] } as any);

      const result = await duckDuckGoSearch('test query');

      expect(result.results).toEqual([]);
      expect(result.reasoning).toContain('找到 0 条结果');
    });

    it('单条搜索结果应正确设置 position', async () => {
      vi.mocked(duckDuckScrape.search).mockResolvedValueOnce({
        results: [{ title: 'Single', url: 'https://example.com', description: 'Desc' }],
      } as any);

      const result = await duckDuckGoSearch('test');

      expect(result.results[0].position).toBe(1);
    });
  });

  describe('错误处理', () => {
    it('搜索失败时应返回错误结果', async () => {
      vi.mocked(duckDuckScrape.search).mockRejectedValueOnce(new Error('Search failed'));

      const result = await duckDuckGoSearch('test query');

      expect(result.error).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.reasoning).toContain('失败');
      expect(result.reasoning).toContain('Search failed');
      expect(result.duration).toBeDefined();
    });

    it('非 Error 类型的异常应转换为字符串', async () => {
      vi.mocked(duckDuckScrape.search).mockRejectedValueOnce('String error');

      const result = await duckDuckGoSearch('test query');

      expect(result.error).toBe(true);
      expect(result.reasoning).toContain('String error');
    });

    it('网络超时错误应被捕获', async () => {
      vi.mocked(duckDuckScrape.search).mockRejectedValueOnce(new Error('Timeout'));

      const result = await duckDuckGoSearch('test query');

      expect(result.error).toBe(true);
      expect(result.duration).toBeDefined();
    });
  });

  describe('数据映射', () => {
    it('应正确映射所有字段', async () => {
      vi.mocked(duckDuckScrape.search).mockResolvedValueOnce({
        results: [
          {
            title: 'Title',
            url: 'https://test.com',
            description: 'Description text',
          },
        ],
      } as any);

      const result = await duckDuckGoSearch('query');

      expect(result.results[0]).toStrictEqual({
        title: 'Title',
        url: 'https://test.com',
        description: 'Description text',
        position: 1,
      });
    });

    it('大量结果应正确编号', async () => {
      const manyResults = Array.from({ length: 100 }, (_, i) => ({
        title: `Result ${i}`,
        url: `https://example.com/${i}`,
        description: `Description ${i}`,
      }));

      vi.mocked(duckDuckScrape.search).mockResolvedValueOnce({ results: manyResults } as any);

      const result = await duckDuckGoSearch('test');

      expect(result.results).toHaveLength(100);
      expect(result.results[0].position).toBe(1);
      expect(result.results[99].position).toBe(100);
    });
  });
});

describe('duckDuckGoBatchSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应串行执行多个搜索', async () => {
    vi.mocked(duckDuckScrape.search)
      .mockResolvedValueOnce({
        results: [{ title: 'Result 1', url: 'https://1.com', description: 'Desc 1' }],
      } as any)
      .mockResolvedValueOnce({
        results: [{ title: 'Result 2', url: 'https://2.com', description: 'Desc 2' }],
      } as any);

    const results = await duckDuckGoBatchSearch(['query1', 'query2']);

    expect(results).toHaveLength(2);
    expect(results[0].query).toBe('query1');
    expect(results[1].query).toBe('query2');
    expect(duckDuckScrape.search).toHaveBeenCalledTimes(2);
  });

  it('空查询数组应返回空结果', async () => {
    const results = await duckDuckGoBatchSearch([]);

    expect(results).toEqual([]);
    expect(duckDuckScrape.search).not.toHaveBeenCalled();
  });

  it('单条查询应正常工作', async () => {
    vi.mocked(duckDuckScrape.search).mockResolvedValueOnce({
      results: [{ title: 'Result', url: 'https://example.com', description: 'Desc' }],
    } as any);

    const results = await duckDuckGoBatchSearch(['single query']);

    expect(results).toHaveLength(1);
    expect(results[0].query).toBe('single query');
  });

  it('部分搜索失败不应影响其他搜索', async () => {
    vi.mocked(duckDuckScrape.search)
      .mockResolvedValueOnce({
        results: [{ title: 'Result 1', url: 'https://1.com', description: 'Desc 1' }],
      } as any)
      .mockRejectedValueOnce(new Error('Failed'));

    const results = await duckDuckGoBatchSearch(['query1', 'query2']);

    expect(results).toHaveLength(2);
    expect(results[0].error).toBeUndefined();
    expect(results[1].error).toBe(true);
  });

  it('查询之间应有延迟', async () => {
    vi.useFakeTimers();

    vi.mocked(duckDuckScrape.search).mockResolvedValue({
      results: [{ title: 'Result', url: 'https://example.com', description: 'Desc' }],
    } as any);

    const promise = duckDuckGoBatchSearch(['q1', 'q2', 'q3']);

    // 初始调用
    expect(duckDuckScrape.search).toHaveBeenCalledTimes(1);

    // 推进时间以触发延迟（现在使用 2000-5000ms 的随机延迟）
    await vi.advanceTimersByTimeAsync(5000);
    expect(duckDuckScrape.search).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5000);
    expect(duckDuckScrape.search).toHaveBeenCalledTimes(3);

    await promise;

    vi.useRealTimers();
  });
});
