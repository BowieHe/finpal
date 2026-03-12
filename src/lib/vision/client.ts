import OpenAI from 'openai';
import { createLogger } from '@/lib/logger';
import { LLMConfig } from '@/types/config';

const logger = createLogger('VisionClient');

// Vision LLM 配置
export interface VisionLLMConfig {
  apiUrl: string;
  apiKey: string;
  modelName: string;
}

/**
 * 创建 Vision LLM 客户端
 * @param config - LLM 配置（从前端传来）
 */
export function createVisionClient(config: VisionLLMConfig): OpenAI {
  if (!config.apiKey) {
    throw new Error(
      '[Vision Client] API Key is required. Please configure it in settings.'
    );
  }
  
  logger.info('Creating Vision LLM client', {
    hasApiKey: true,
    apiKeyLength: config.apiKey.length,
    apiUrl: config.apiUrl,
    modelName: config.modelName,
  });

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiUrl,
  });
}

// 分析基金截图的返回结果
export interface FundScreenshotAnalysis {
  funds: {
    code: string;
    name: string;
    shares?: number;
    costPrice?: number;
    currentNav?: number;
    profit?: number;
    profitRate?: number;
    chartTrend?: 'up' | 'down' | 'volatile' | 'stable';
  }[];
  totalProfit?: number;
  analysisDate?: string;
  rawResponse?: string;
}

/**
 * 分析基金截图
 * @param imageBase64 - Base64 编码的图片
 * @param prompt - 自定义提示词（可选）
 * @param config - LLM 配置（从前端传来）
 */
export async function analyzeFundScreenshot(
  imageBase64: string,
  prompt?: string,
  config?: LLMConfig,
): Promise<FundScreenshotAnalysis> {
  if (!config) {
    throw new Error('[Vision Client] Configuration is required');
  }

  const client = createVisionClient(config);

  const defaultPrompt = `请分析这张基金持仓截图，提取以下信息：
1. 基金代码和名称
2. 持仓份额
3. 持仓成本/当前净值
4. 持有收益和收益率
5. 收益曲线/走势图的趋势（上涨、下跌、震荡、平稳）

请以 JSON 格式返回：
{
  "funds": [
    {
      "code": "基金代码",
      "name": "基金名称",
      "shares": 持仓份额,
      "costPrice": 成本价,
      "currentNav": 当前净值,
      "profit": 持有收益,
      "profitRate": 收益率（百分比数字）,
      "chartTrend": "up|down|volatile|stable"
    }
  ],
  "totalProfit": 总收益,
  "analysisDate": "分析日期"
}`;

  try {
    logger.info('Analyzing fund screenshot...');

    const response = await client.chat.completions.create({
      model: config.modelName || 'qwen-vl-max',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt || defaultPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content || '';
    logger.info('Vision LLM response received', { contentLength: content.length });

    // 尝试解析 JSON
    try {
      // 提取 JSON 部分（LLM 可能会返回 markdown 格式的 JSON）
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                       content.match(/\{[\s\S]*\}/);

      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr);

      return {
        funds: parsed.funds || [],
        totalProfit: parsed.totalProfit,
        analysisDate: parsed.analysisDate,
        rawResponse: content,
      };
    } catch (parseError) {
      logger.warn('Failed to parse JSON response, returning raw text', { error: parseError });
      return {
        funds: [],
        rawResponse: content,
      };
    }
  } catch (error) {
    logger.error('Vision analysis failed', { error });
    throw new Error(`Failed to analyze screenshot: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 流式分析基金截图（支持实时输出）
 * @param imageBase64 - Base64 编码的图片
 * @param onChunk - 流式回调函数
 * @param prompt - 自定义提示词（可选）
 * @param config - LLM 配置（从前端传来）
 */
export async function analyzeFundScreenshotStream(
  imageBase64: string,
  onChunk: (chunk: string) => void,
  prompt?: string,
  config?: LLMConfig,
): Promise<string> {
  if (!config) {
    throw new Error('[Vision Client] Configuration is required');
  }

  const client = createVisionClient(config);

  const defaultPrompt = `请分析这张基金持仓截图，提取以下信息：
1. 基金代码和名称
2. 持仓份额
3. 持仓成本/当前净值
4. 持有收益和收益率
5. 收益曲线/走势图的趋势（上涨、下跌、震荡、平稳）

请以 JSON 格式返回：`;

  try {
    logger.info('Starting streaming vision analysis...');

    const stream = await client.chat.completions.create({
      model: config.modelName || 'qwen-vl-max',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt || defaultPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    logger.info('Streaming vision analysis completed', { contentLength: fullContent.length });
    return fullContent;
  } catch (error) {
    logger.error('Streaming vision analysis failed', { error });
    throw new Error(`Failed to analyze screenshot: ${error instanceof Error ? error.message : String(error)}`);
  }
}
