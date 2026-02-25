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
      apiUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1',
      modelName: process.env.OPENAI_MODEL || 'deepseek-reasoner',
      apiKey: process.env.OPENAI_API_KEY || '',
    };

    if (!llmConfig.apiKey || llmConfig.apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    setLLMInstance(llmConfig);

    const result = await chatGraph.invoke({
      question,
      optimisticAnswer: '',
      pessimisticAnswer: '',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
