import { NextRequest, NextResponse } from 'next/server';
import { chatGraph } from '@/lib/graph/graph';

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Invalid question parameter' },
        { status: 400 }
      );
    }

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
