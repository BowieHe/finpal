import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aliyunWebSearch, aliyunWebSearchWithAnswer } from './aliyun-websearch';

// 模拟 logger
vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('aliyunWebSearch', () => {
  const mockFetch = vi.fn();
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch;
    vi.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.DASHSCOPE_API_KEY;
  });

  describe('API Key 未配置', () => {
    it('当 DASHSCOPE_API_KEY 未设置时应返回错误结果', async () => {
      delete process.env.DASHSCOPE_API_KEY;

      const result = await aliyunWebSearch('测试查询');

      expect(result.error).toBe(true);
      expect(result.engine).toBe('aliyun-websearch');
      expect(result.results).toEqual([]);
      expect(result.reasoning).toContain('API Key 未配置');

      // 恢复设置以便其他测试
      process.env.DASHSCOPE_API_KEY = 'test-api-key';
    });
  });

  describe('成功响应', () => {
    it('模型触发搜索并返回结果时应正确解析', async () => {
      const mockSearchResults = [
        { title: '结果1', link: 'https://example.com/1', snippet: '描述1' },
        { title: '结果2', link: 'https://example.com/2', snippet: '描述2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: {
                        name: 'web_search',
                        arguments: JSON.stringify({
                          search_results: mockSearchResults,
                        }),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: {
              input_tokens: 100,
              output_tokens: 200,
              total_tokens: 300,
            },
          }),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.error).toBeFalsy();
      expect(result.engine).toBe('aliyun-websearch');
      expect(result.query).toBe('测试查询');
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        title: '结果1',
        url: 'https://example.com/1',
        description: '描述1',
        position: 1,
      });
      expect(result.results[1]).toEqual({
        title: '结果2',
        url: 'https://example.com/2',
        description: '描述2',
        position: 2,
      });
      expect(result.reasoning).toContain('找到 2 条结果');
      expect(result.duration).toBeDefined();
    });

    it('模型未触发搜索时应返回空结果', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: '直接回答，不需要搜索',
                  tool_calls: [],
                },
                finish_reason: 'stop',
              },
            ],
          }),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.error).toBeFalsy();
      expect(result.results).toEqual([]);
      expect(result.reasoning).toContain('未触发搜索');
    });

    it('搜索结果使用 url 而非 link 字段时应正确解析', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      function: {
                        name: 'web_search',
                        arguments: JSON.stringify({
                          search_results: [
                            { title: '结果', url: 'https://example.com', content: '内容' },
                          ],
                        }),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.results[0].url).toBe('https://example.com');
      expect(result.results[0].description).toBe('内容');
    });
  });

  describe('API 错误处理', () => {
    it('401 错误应返回错误结果', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.error).toBe(true);
      expect(result.reasoning).toContain('401');
      expect(result.results).toEqual([]);
    });

    it('403 错误应返回错误结果', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.error).toBe(true);
      expect(result.reasoning).toContain('403');
    });

    it('429 限流错误应返回错误结果', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.error).toBe(true);
      expect(result.reasoning).toContain('429');
    });

    it('网络请求失败应返回错误结果', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await aliyunWebSearch('测试查询');

      expect(result.error).toBe(true);
      expect(result.reasoning).toContain('失败');
      expect(result.reasoning).toContain('Network error');
    });

    it('超时错误应被正确处理', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await aliyunWebSearch('测试查询');

      expect(result.error).toBe(true);
      expect(result.duration).toBeDefined();
    });
  });

  describe('数据解析容错', () => {
    it('搜索结果格式不正确时应返回空数组', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      function: {
                        name: 'web_search',
                        arguments: 'invalid json',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.results).toEqual([]);
    });

    it('返回数据结构不完整时应优雅处理', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.results).toEqual([]);
    });

    it('搜索结果缺少字段时应使用默认值', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      function: {
                        name: 'web_search',
                        arguments: JSON.stringify({
                          search_results: [{ title: null, link: null, snippet: null }],
                        }),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
      });

      const result = await aliyunWebSearch('测试查询');

      expect(result.results[0].title).toBe('无标题');
      expect(result.results[0].url).toBe('');
      expect(result.results[0].description).toBe('');
    });
  });
});

describe('aliyunWebSearchWithAnswer', () => {
  const mockFetch = vi.fn();
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch;
    vi.clearAllMocks();
    process.env.DASHSCOPE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.DASHSCOPE_API_KEY;
  });

  it('应返回搜索结果和完整回答', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: '这是AI的完整回答',
                tool_calls: [
                  {
                    function: {
                      name: 'web_search',
                      arguments: JSON.stringify({
                        search_results: [
                          { title: '结果1', link: 'https://example.com', snippet: '描述' },
                        ],
                      }),
                    },
                  },
                ],
              },
              finish_reason: 'stop',
            },
          ],
        }),
    });

    const result = await aliyunWebSearchWithAnswer('测试查询');

    expect(result.searchResult).toBeDefined();
    expect(result.searchResult.results).toHaveLength(1);
    expect(result.answer).toBe('这是AI的完整回答');
  });

  it('API Key 未配置时应返回错误', async () => {
    delete process.env.DASHSCOPE_API_KEY;

    const result = await aliyunWebSearchWithAnswer('测试查询');

    expect(result.searchResult.error).toBe(true);
    expect(result.answer).toBeUndefined();

    process.env.DASHSCOPE_API_KEY = 'test-api-key';
  });

  it('API 错误时应返回错误信息', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const result = await aliyunWebSearchWithAnswer('测试查询');

    expect(result.searchResult.error).toBe(true);
    expect(result.searchResult.reasoning).toContain('失败');
  });
});
