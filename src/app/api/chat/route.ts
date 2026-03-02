import { NextRequest, NextResponse } from 'next/server';
import { createGraph } from '@/lib/graph/graph';
import { setLLMInstance } from '@/lib/llm/client';
import { LLMConfig } from '@/types/config';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import type { GraphState } from '@/lib/graph/state';

const logger = createLogger('ChatAPI');

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(clientId, {
      maxRequests: 10,
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
    const { question, config, deepResearch, deepResearchConfig } = body;

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
      deepResearch: !!deepResearch,
      question: question.substring(0, 100),
    });

    setLLMInstance(llmConfig);

    const graph = createGraph({ deepResearch: !!deepResearch });

    const startTime = Date.now();

    const initialState: Partial<GraphState> = {
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
    };

    if (deepResearch) {
      initialState.deepResearchEnabled = true;
      initialState.currentDepth = 0;
      initialState.maxDepth = deepResearchConfig?.maxDepth || 2;
      initialState.breadth = deepResearchConfig?.breadth || 3;
      initialState.subTasks = [];
      initialState.allFindings = [];
      initialState.researchPlan = [];
    }

    const result = await graph.invoke(initialState);

    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      duration,
      deepResearch: !!deepResearch,
      hasOptimistic: !!result.optimisticAnswer,
      hasPessimistic: !!result.pessimisticAnswer,
      winner: result.debateWinner,
      findingsCount: result.allFindings?.length || 0,
    });

    return NextResponse.json(result, {
      headers: getRateLimitHeaders(rateLimitResult),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Request failed', { error: errorMessage });
    return NextResponse.json(
      { error: 'Failed to process chat request', details: errorMessage },
      { status: 500 }
    );
  }
}
