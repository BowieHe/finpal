/**
 * 阿里云 Qwen Web Search 实现
 * 使用阿里云 DashScope API 的 qwen-3.5-plus 模型内置搜索功能
 *
 * 文档：https://help.aliyun.com/zh/model-studio/web-search
 */

import { SearchResult, SearchResultItem } from '@/types/mcp';
import { createLogger } from '../logger';

const logger = createLogger('AliyunWebSearch');

// 阿里云 DashScope API 配置（OpenAI 兼容模式）
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// 获取 API Key（运行时读取，支持测试环境动态设置）
const getApiKey = (): string => process.env.DASHSCOPE_API_KEY || '';

interface AliyunToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface AliyunMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: AliyunToolCall[];
  tool_call_id?: string;
}

interface AliyunSearchResponse {
  choices: Array<{
    message: AliyunMessage;
    finish_reason: string;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

/**
 * 解析搜索工具调用结果
 */
function parseSearchResults(toolArguments: string): SearchResultItem[] {
  try {
    const args = JSON.parse(toolArguments);
    const results: SearchResultItem[] = [];

    if (args.search_results && Array.isArray(args.search_results)) {
      for (const item of args.search_results) {
        results.push({
          title: item.title || '无标题',
          url: item.link || item.url || '',
          description: item.snippet || item.content || '',
          position: results.length + 1,
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Failed to parse search results', { error, arguments: toolArguments });
    return [];
  }
}

/**
 * 使用阿里云 Qwen 进行 Web Search
 * 模型会自动判断是否需要搜索，并返回搜索结果
 */
export async function aliyunWebSearch(query: string): Promise<SearchResult> {
  const startTime = Date.now();

  if (!getApiKey()) {
    logger.error('DASHSCOPE_API_KEY not configured');
    return {
      query,
      engine: 'aliyun-websearch',
      results: [],
      timestamp: Date.now(),
      reasoning: '阿里云 DashScope API Key 未配置',
      error: true,
    };
  }

  logger.info('Starting Aliyun Web Search', { query });

  try {
    const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: '你是一个智能搜索助手。当用户询问实时信息、新闻、价格、行情、天气等可能随时间变化的内容时，你必须使用 web_search 工具搜索最新信息。不要依赖训练数据中的过时信息。',
          },
          {
            role: 'user',
            content: query,
          },
        ],
        enable_search: true,
        search_options: {
          forced_search: true,
          search_strategy: 'max',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Aliyun API error', { status: response.status, error: errorText });
      return {
        query,
        engine: 'aliyun-websearch',
        results: [],
        timestamp: Date.now(),
        reasoning: `阿里云 API 错误: ${response.status} - ${errorText}`,
        error: true,
      };
    }

    const data: AliyunSearchResponse = await response.json();
    const duration = Date.now() - startTime;

    // 提取搜索结果
    const searchResults: SearchResultItem[] = [];
    let searchTriggered = false;

    if (data.choices && data.choices.length > 0) {
      const message = data.choices[0].message;

      // 检查是否有工具调用（搜索触发）
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name === 'web_search') {
            searchTriggered = true;
            const results = parseSearchResults(toolCall.function.arguments);
            searchResults.push(...results);
          }
        }
      }
    }

    logger.info('Aliyun Web Search completed', {
      duration,
      searchTriggered,
      resultCount: searchResults.length,
    });

    return {
      query,
      engine: 'aliyun-websearch',
      results: searchResults,
      timestamp: Date.now(),
      reasoning: searchTriggered
        ? `阿里云 Web Search 完成，找到 ${searchResults.length} 条结果，耗时 ${duration}ms`
        : '模型未触发搜索（可能认为无需搜索）',
      duration,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Aliyun Web Search failed', { error: errorMessage, duration });

    return {
      query,
      engine: 'aliyun-websearch',
      results: [],
      timestamp: Date.now(),
      reasoning: `阿里云 Web Search 失败: ${errorMessage}`,
      duration,
      error: true,
    };
  }
}

/**
 * 使用阿里云 Qwen 进行增强型搜索
 * 包含搜索结果的完整回答
 */
export async function aliyunWebSearchWithAnswer(query: string): Promise<{
  searchResult: SearchResult;
  answer?: string;
}> {
  const startTime = Date.now();

  if (!getApiKey()) {
    logger.error('DASHSCOPE_API_KEY not configured');
    return {
      searchResult: {
        query,
        engine: 'aliyun-websearch',
        results: [],
        timestamp: Date.now(),
        reasoning: '阿里云 DashScope API Key 未配置',
        error: true,
      },
    };
  }

  logger.info('Starting Aliyun Web Search with answer', { query });

  try {
    const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: '你是一个智能搜索助手。当用户询问实时信息、新闻、价格、行情、天气等可能随时间变化的内容时，你必须使用 web_search 工具搜索最新信息。不要依赖训练数据中的过时信息。',
          },
          {
            role: 'user',
            content: query,
          },
        ],
        enable_search: true,
        search_options: {
          forced_search: true,
          search_strategy: 'max',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data: AliyunSearchResponse = await response.json();
    const duration = Date.now() - startTime;

    const searchResults: SearchResultItem[] = [];
    let answer = '';

    if (data.choices && data.choices.length > 0) {
      const message = data.choices[0].message;

      // 提取回答内容
      if (message.content) {
        answer = message.content;
      }

      // 提取搜索结果
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name === 'web_search') {
            const results = parseSearchResults(toolCall.function.arguments);
            searchResults.push(...results);
          }
        }
      }
    }

    logger.info('Aliyun Web Search with answer completed', {
      duration,
      resultCount: searchResults.length,
      hasAnswer: !!answer,
    });

    return {
      searchResult: {
        query,
        engine: 'aliyun-websearch',
        results: searchResults,
        timestamp: Date.now(),
        reasoning: `阿里云 Web Search 完成，找到 ${searchResults.length} 条结果，耗时 ${duration}ms`,
        duration,
      },
      answer,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Aliyun Web Search with answer failed', { error: errorMessage });

    return {
      searchResult: {
        query,
        engine: 'aliyun-websearch',
        results: [],
        timestamp: Date.now(),
        reasoning: `搜索失败: ${errorMessage}`,
        error: true,
      },
    };
  }
}
