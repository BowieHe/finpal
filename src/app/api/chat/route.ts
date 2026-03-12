import { NextResponse } from 'next/server';
import { createGraph } from '@/lib/graph/graph';
import { clearConfigCache, validateConfig } from '@/lib/llm/client';
import { prisma } from '@/lib/prisma';
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

    // 首先验证配置是否完整
    const validation = await validateConfig();
    if (!validation.valid) {
      logger.warn('Configuration validation failed', { missing: validation.missing });
      return NextResponse.json(
        { 
          error: 'Configuration Error', 
          message: validation.message,
          missing: validation.missing,
          details: '请在设置页面配置 API Key 和其他必要信息'
        },
        { status: 400 }
      );
    }

    // 使用前端传来的 config，如果用户临时修改了设置，我们应该确保后续调用能反映出来
    if (config?.apiKey) {
      logger.info('Using custom LLM config from frontend, updating persistent settings', {
        apiUrl: config.apiUrl,
        modelName: config.modelName,
        hasApiKey: true,
      });
      
      // 我们选择将前端传来的临时配置也同步到数据库中，以确保真正的"持久化"
      // 这里的逻辑是：如果前端传了 config，说明用户在页面上点击了保存或正在使用新配置
      await prisma.settings.upsert({
        where: { id: 1 },
        update: {
          apiUrl: config.apiUrl,
          modelName: config.modelName,
          apiKey: config.apiKey,
          dashscopeApiKey: config.dashscopeApiKey,
          updatedAt: new Date(),
        },
        create: {
          id: 1,
          apiUrl: config.apiUrl,
          modelName: config.modelName,
          apiKey: config.apiKey,
          dashscopeApiKey: config.dashscopeApiKey,
        },
      });
      
      clearConfigCache();
    }

    // 存储 dashscopeApiKey 到全局，供 MCP 使用
    const persistentConfig = await prisma.settings.findUnique({ where: { id: 1 } });
    if (persistentConfig?.dashscopeApiKey) {
      (global as any).DASHSCOPE_API_KEY = persistentConfig.dashscopeApiKey;
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
