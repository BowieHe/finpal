import { describe, it, expect, vi } from 'vitest';
import { getContentString, extractJSONFromText } from './nodes';
import { withRetry } from '../llm/client';
import { quickClassify } from '../search/query-classifier';

describe('getContentString', () => {
  it('should return string content as-is', () => {
    expect(getContentString('hello world')).toBe('hello world');
  });

  it('should join array of strings', () => {
    expect(getContentString(['hello', 'world'])).toBe('helloworld');
  });

  it('should extract text from objects with text property', () => {
    expect(getContentString({ text: 'hello' })).toBe('hello');
  });

  it('should handle array of objects with text property', () => {
    expect(getContentString([{ text: 'hello' }, { text: ' world' }])).toBe('hello world');
  });

  it('should return empty string for null/undefined', () => {
    expect(getContentString(null)).toBe('');
    expect(getContentString(undefined)).toBe('');
  });
});

describe('extractJSONFromText', () => {
  it('should extract valid JSON object', () => {
    const text = 'Some text {"key": "value"} more text';
    const result = extractJSONFromText(text);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for no JSON found', () => {
    const text = 'No JSON here';
    const result = extractJSONFromText(text);
    expect(result).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    const text = '{invalid json}';
    const result = extractJSONFromText(text);
    expect(result).toBeNull();
  });

  it('should extract complex JSON', () => {
    const text = 'Response: {"thinking": "process", "answer": "result", "data_used": ["item1"]}';
    const result = extractJSONFromText(text);
    expect(result).toEqual({
      thinking: 'process',
      answer: 'result',
      data_used: ['item1']
    });
  });

  it('should parse direct JSON string', () => {
    const text = '{"answer": "test"}';
    const result = extractJSONFromText(text);
    expect(result).toEqual({ answer: 'test' });
  });

  it('should extract JSON from markdown code block', () => {
    const text = '```json\n{"answer": "test"}\n```';
    const result = extractJSONFromText(text);
    expect(result).toEqual({ answer: 'test' });
  });

  it('should extract JSON from code block without language', () => {
    const text = '```\n{"answer": "test"}\n```';
    const result = extractJSONFromText(text);
    expect(result).toEqual({ answer: 'test' });
  });

  it('should handle nested JSON objects', () => {
    const text = '{"outer": {"inner": "value"}}';
    const result = extractJSONFromText(text);
    expect(result).toEqual({ outer: { inner: 'value' } });
  });

  it('should handle JSON with special characters', () => {
    const text = '{"text": "Hello\\nWorld\\t!"}';
    const result = extractJSONFromText(text);
    expect(result).toEqual({ text: 'Hello\nWorld\t!' });
  });
});

describe('withRetry', () => {
  it('should return result on successful operation', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await withRetry(operation, 2, 100);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(operation, 3, 50);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(withRetry(operation, 2, 10)).rejects.toThrow('Failed after 3 attempts');
    expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should handle non-Error exceptions', async () => {
    const operation = vi.fn().mockRejectedValue('string error');

    await expect(withRetry(operation, 1, 10)).rejects.toThrow('string error');
  });
});

describe('quickClassify', () => {
  it('should classify finance_news correctly', () => {
    expect(quickClassify('最新股市新闻')).toBe('finance_news');
    expect(quickClassify('美联储利率决议')).toBe('finance_news');
    expect(quickClassify('Bloomberg market news')).toBe('finance_news');
  });

  it('should classify finance_data correctly', () => {
    expect(quickClassify('特斯拉股价是多少')).toBe('finance_data');
    expect(quickClassify('AAPL 市盈率')).toBe('finance_data');
    expect(quickClassify('美股行情')).toBe('finance_data');
    expect(quickClassify('基金净值查询')).toBe('finance_data');
  });

  it('should classify encyclopedia correctly', () => {
    expect(quickClassify('什么是通货膨胀')).toBe('encyclopedia');
    expect(quickClassify('ETF definition')).toBe('encyclopedia');
    expect(quickClassify('wikipedia finance')).toBe('encyclopedia');
  });

  it('should classify academic correctly', () => {
    expect(quickClassify('论文研究')).toBe('academic');
    expect(quickClassify('量化模型')).toBe('academic');
    expect(quickClassify('arXiv论文')).toBe('academic');
  });

  it('should classify government correctly', () => {
    // 关键词匹配顺序：finance_data > finance_news > academic > government
    // '央行' 在 finance_news 关键词中，'政策' 在 government 关键词中
    expect(quickClassify('GDP')).toBe('government');
    expect(quickClassify('CPI 统计')).toBe('government');
    expect(quickClassify('IMF')).toBe('government');
    expect(quickClassify('统计局发布')).toBe('government');
  });

  it('should classify community correctly', () => {
    expect(quickClassify('知乎讨论')).toBe('community');
    expect(quickClassify('Reddit opinion')).toBe('community');
    expect(quickClassify('Quora问答')).toBe('community');
  });

  it('should default to general for unknown queries', () => {
    expect(quickClassify('hello world')).toBe('general');
    expect(quickClassify('random query')).toBe('general');
    expect(quickClassify('')).toBe('general');
  });

  it('should be case insensitive', () => {
    expect(quickClassify('STOCK PRICE')).toBe('finance_data');
    expect(quickClassify('WIKIPEDIA')).toBe('encyclopedia');
  });
});
