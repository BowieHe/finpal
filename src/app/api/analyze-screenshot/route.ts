import { NextRequest, NextResponse } from 'next/server';
import { analyzeFundScreenshot, FundScreenshotAnalysis } from '@/lib/vision/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AnalyzeScreenshotAPI');

export const runtime = 'edge';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    logger.info('Received screenshot analysis request');

    // 解析请求体
    const body = await request.json();
    const { image, prompt } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // 验证图片格式 (Base64)
    if (!image.startsWith('data:image')) {
      return NextResponse.json(
        { error: 'Invalid image format. Expected base64 data URL' },
        { status: 400 }
      );
    }

    // 提取 base64 数据
    const base64Data = image.split(',')[1];
    if (!base64Data) {
      return NextResponse.json(
        { error: 'Invalid image data' },
        { status: 400 }
      );
    }

    // 检查图片大小 (限制 5MB)
    const sizeInBytes = Buffer.from(base64Data, 'base64').length;
    if (sizeInBytes > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    logger.info('Analyzing screenshot...', { 
      imageSize: sizeInBytes,
      hasCustomPrompt: !!prompt 
    });

    // 调用 Vision LLM 分析
    const result = await analyzeFundScreenshot(base64Data, prompt);

    logger.info('Screenshot analysis completed', { 
      fundCount: result.funds?.length || 0 
    });

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Screenshot analysis failed', { error });
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze screenshot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
