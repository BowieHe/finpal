import { NextRequest, NextResponse } from 'next/server';
import { chatGraph } from '@/lib/graph/graph';
import { setLLMInstance } from '@/lib/llm/client';
import { LLMConfig } from '@/types/config';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ChatAPI');

export async function POST(request: NextRequest) {
  try {
    // 速率限制检查
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(clientId, {
      maxRequests: 10,  // 每分钟最多 10 次请求
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { clientId });
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
            'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { question, config } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Invalid question parameter', details: '问题不能为空' },
        { status: 400, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const llmConfig: LLMConfig = config || {
      apiUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
      modelName: process.env.OPENAI_MODEL || 'deepseek-chat',
      apiKey: process.env.OPENAI_API_KEY || '',
    };

    if (!llmConfig.apiKey || llmConfig.apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'API key is required', details: '请配置 API Key' },
        { status: 400, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    logger.info('Request started', {
      apiUrl: llmConfig.apiUrl,
      modelName: llmConfig.modelName,
      searchStrategy: llmConfig.searchStrategy,
      question: question.substring(0, 100),
    });

    setLLMInstance(llmConfig);

    const startTime = Date.now();

    const result = await chatGraph.invoke({
      question,
      searchStrategy: llmConfig.searchStrategy || 'smart',
      searchResults: [],
      researchSummary: null,
      engineUsage: {},
      optimisticThinking: '',
      optimisticAnswer: '',
      optimisticRebuttal: '',
      pessimisticThinking: '',
      pessimisticAnswer: '',
      pessimisticRebuttal: '',
      shouldContinue: false,
      round: 0,
      maxRounds: 2,
      debateWinner: 'draw',
      debateSummary: '',
    });

    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      duration,
      hasOptimistic: !!result.optimisticAnswer,
      hasPessimistic: !!result.pessimisticAnswer,
      hasRebuttal: !!result.optimisticRebuttal,
      winner: result.debateWinner,
    });

    return NextResponse.json(result, {
      headers: getRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Request failed', {
      error: errorMessage,
      stack: errorStack,
    });

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
