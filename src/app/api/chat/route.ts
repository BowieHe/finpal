import { NextRequest, NextResponse } from 'next/server';
import { chatGraph } from '@/lib/graph/graph';
import { setLLMInstance } from '@/lib/llm/client';
import { LLMConfig } from '@/types/config';

export async function POST(request: NextRequest) {
  try {
    const { question, config } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Invalid question parameter' },
        { status: 400 }
      );
    }

    const llmConfig: LLMConfig = config || {
      apiUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
      modelName: process.env.OPENAI_MODEL || 'deepseek-chat',
      apiKey: process.env.OPENAI_API_KEY || '',
    };

    if (!llmConfig.apiKey || llmConfig.apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    console.log('[Chat API] Request config:', {
      apiUrl: llmConfig.apiUrl,
      modelName: llmConfig.modelName,
      hasApiKey: !!llmConfig.apiKey,
      question: question.substring(0, 50) + '...'
    });

    setLLMInstance(llmConfig);

    const startTime = Date.now();
    const result = await chatGraph.invoke({
      question,
      optimisticAnswer: '',
      pessimisticAnswer: '',
    });
    const duration = Date.now() - startTime;

    console.log('[Chat API] Request completed:', {
      duration: `${duration}ms`,
      hasOptimistic: !!result.optimisticAnswer,
      hasPessimistic: !!result.pessimisticAnswer,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Chat API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined,
      fullError: error
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = (error as any).status || 500;

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}
