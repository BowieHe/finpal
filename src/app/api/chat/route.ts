import { NextResponse } from 'next/server';
import { createGraph } from '@/lib/graph/graph';
import { setLLMInstance } from '@/lib/llm/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('APIChat');

export async function GET() {
  return NextResponse.json({ ok: true, message: 'FinPal API is running' });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, config } = body;

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    logger.info('Processing chat request', { question });

    // 使用前端传来的 config 覆盖默认配置
    if (config?.apiKey) {
      logger.info('Using custom LLM config from frontend', {
        apiUrl: config.apiUrl,
        modelName: config.modelName,
        hasApiKey: true,
      });
      setLLMInstance(config);
    }

    // 存储 dashscopeApiKey 到全局，供 MCP 使用
    if (config?.dashscopeApiKey) {
      (global as any).DASHSCOPE_API_KEY = config.dashscopeApiKey;
      logger.info('DashScope API Key configured from frontend');
    }

    // Check if client accepts SSE
    const acceptHeader = req.headers.get('accept') || '';
    const wantsStream = acceptHeader.includes('text/event-stream');

    if (wantsStream) {
      // Return SSE stream
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();

      // Start processing in background
      (async () => {
        try {
          const graph = createGraph();
          const { signal } = req;

          // Create a promise that rejects when the client disconnects
          const abortPromise = new Promise<never>((_, reject) => {
            signal.addEventListener('abort', () => reject(new Error('AbortError')));
          });

          const result = await Promise.race([
            graph.invoke({
              question,
              progressCallback: (event) => {
                if (signal.aborted) return;
                try {
                  const data = `data: ${JSON.stringify(event)}\n\n`;
                  writer.write(encoder.encode(data));
                } catch { /* writer already closed */ }
              },
            }),
            abortPromise,
          ]);

          if (!signal.aborted) {
            // Send final result
            const finalData = `data: ${JSON.stringify({ type: 'complete', result })}\n\n`;
            writer.write(encoder.encode(finalData));
          }
          writer.close();
        } catch (error: any) {
          const isAbort = error?.message === 'AbortError' || error?.name === 'AbortError';
          if (!isAbort) {
            logger.error('Graph execution error', { error: String(error) });
            try {
              const errorData = `data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`;
              writer.write(encoder.encode(errorData));
            } catch { /* writer already closed */ }
          }
          try { writer.close(); } catch { /* already closed */ }
        }
      })();

      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Return regular JSON response
      const graph = createGraph();
      
      const result = await graph.invoke({
        question,
      });

      return NextResponse.json(result);
    }
  } catch (error) {
    logger.error('API error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
