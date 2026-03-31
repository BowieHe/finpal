import { NextResponse } from 'next/server';
import { createLLMClient, streamWithCallback } from '@/lib/llm/client';
import { getConfig } from '@/lib/config/manager';
import { createLogger } from '@/lib/logger';

const logger = createLogger('APISummarize');

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const config = await getConfig();
    
    // 优先使用轻量级模型进行总结任务
    const modelToUse = config.lightModelName || config.modelName;
    
    logger.info('Summarizing conversation title', { question: question.substring(0, 50), model: modelToUse });

    const llm = createLLMClient({
        ...config,
        modelName: modelToUse
    });

    const prompt = `请将以下投资者的第一个问题总结成一个 4 到 8 个字的中文标题，要求干练、专业，不要包含任何标点符号。
提问内容：${question}
标题：`;

    const title = await streamWithCallback(
      prompt,
      () => {},
      0,
      llm
    );
    const cleanRawTitle = title.trim() || '新对话';
    
    // 移除可能的引导词和标点
    const cleanTitle = cleanRawTitle.replace(/^标题[：:]\s*/, '').replace(/[。！？，]$/, '').trim();

    return NextResponse.json({ title: cleanTitle });
  } catch (error) {
    logger.error('Summarization error', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
