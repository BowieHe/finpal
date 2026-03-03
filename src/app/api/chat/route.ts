import { NextRequest } from 'next/server';
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
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          details: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(rateLimitResult),
            'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { question, config, deepResearch, deepResearchConfig } = body;

    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid question parameter', details: '问题不能为空' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(rateLimitResult) 
          } 
        }
      );
    }

    const llmConfig: LLMConfig = config || {
      apiUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
      modelName: process.env.OPENAI_MODEL || 'deepseek-chat',
      apiKey: process.env.OPENAI_API_KEY || '',
    };

    if (!llmConfig.apiKey || llmConfig.apiKey.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'API key is required', details: '请配置 API Key' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(rateLimitResult) 
          } 
        }
      );
    }

    // Check if client wants streaming
    const acceptHeader = request.headers.get('accept');
    const wantsStream = acceptHeader?.includes('text/event-stream');

    logger.info('Request started', {
      apiUrl: llmConfig.apiUrl,
      modelName: llmConfig.modelName,
      deepResearch: !!deepResearch,
      wantsStream,
      question: question.substring(0, 100),
    });

    setLLMInstance(llmConfig);

    const graph = createGraph({ deepResearch: !!deepResearch });

    const startTime = Date.now();

    const initialState: Partial<GraphState> = {
      question,
      searchResults: [],
      researchSummary: null,
      engineUsage: {},
      optimisticAnswer: '',
      optimisticRebuttal: '',
      pessimisticThinking: '',
      pessimisticAnswer: '',
      pessimisticRebuttal: '',

    if (deepResearch) {
      initialState.deepResearchEnabled = true;
      initialState.currentDepth = 0;
      initialState.maxDepth = deepResearchConfig?.maxDepth || 2;
      initialState.breadth = deepResearchConfig?.breadth || 3;
      initialState.subTasks = [];
      initialState.allFindings = [];
      initialState.researchPlan = [];
    }

    // If streaming is requested, return SSE stream
    if (wantsStream) {
      const encoder = new TextEncoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial state
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'start', question, deepResearch })}

`
            ));

            // Send planning status (immediate)
            if (deepResearch) {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'planning' })}

`
              ));
            }

            // Execute graph
            const result = await graph.invoke(initialState);

            // Send analyzing status before returning result
            if (deepResearch) {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'analyzing' })}

`
              ));
            }

            const duration = Date.now() - startTime;

            logger.info('Request completed (stream)', {
              duration,
              deepResearch: !!deepResearch,
              hasOptimistic: !!result.optimisticAnswer,
              hasPessimistic: !!result.pessimisticAnswer,
              winner: result.debateWinner,
              findingsCount: result.allFindings?.length || 0,
            });

            // Send final result
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'complete', result })}

`
            ));

            controller.close();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Stream error', { error: errorMessage });
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: errorMessage })}

`
            ));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...getRateLimitHeaders(rateLimitResult),
        },
      });
    }

    // Non-streaming mode (original behavior)
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

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(rateLimitResult),
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Request failed', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request', details: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
