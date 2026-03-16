import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SettingsSchema } from '@/lib/db-schema';
import { clearConfigCache } from '@/lib/llm/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SettingsAPI');

export async function GET() {
  try {
    const result = await query('SELECT * FROM settings WHERE id = 1');
    const settings = result.rows[0];
    
    if (!settings) {
      return NextResponse.json({});
    }

    // Transform snake_case to camelCase if needed, or just parse
    const parsed = SettingsSchema.parse(settings);
    
    return NextResponse.json({
      apiUrl: parsed.api_url,
      modelName: parsed.model_name,
      apiKey: parsed.api_key,
      dashscopeApiKey: parsed.dashscope_api_key,
    });
  } catch (error) {
    logger.error('Failed to fetch settings', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiUrl, modelName, apiKey, dashscopeApiKey } = body;

    const sql = `
      INSERT INTO settings (id, api_url, model_name, api_key, dashscope_api_key, updated_at)
      VALUES (1, $1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        api_url = EXCLUDED.api_url,
        model_name = EXCLUDED.model_name,
        api_key = EXCLUDED.api_key,
        dashscope_api_key = EXCLUDED.dashscope_api_key,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await query(sql, [apiUrl, modelName, apiKey, dashscopeApiKey]);
    const parsed = SettingsSchema.parse(result.rows[0]);

    // Clear the in-memory cache so next request picks up new settings
    clearConfigCache();
    
    logger.info('Settings updated successfully');
    return NextResponse.json({
      apiUrl: parsed.api_url,
      modelName: parsed.model_name,
      apiKey: parsed.api_key,
      dashscope_api_key: parsed.dashscope_api_key,
    });
  } catch (error) {
    logger.error('Failed to update settings', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
