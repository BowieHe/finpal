import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearConfigCache } from '@/lib/llm/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SettingsAPI');

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    return NextResponse.json(settings || {});
  } catch (error) {
    logger.error('Failed to fetch settings', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiUrl, modelName, apiKey, dashscopeApiKey } = body;

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {
        apiUrl,
        modelName,
        apiKey,
        dashscopeApiKey,
        updatedAt: new Date(),
      },
      create: {
        id: 1,
        apiUrl,
        modelName,
        apiKey,
        dashscopeApiKey,
      },
    });

    // Clear the in-memory cache so next request picks up new settings
    clearConfigCache();
    
    logger.info('Settings updated successfully');
    return NextResponse.json(settings);
  } catch (error) {
    logger.error('Failed to update settings', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
