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

    // 1. Fetch existing settings for merging to avoid destructive updates
    const existingResult = await query('SELECT * FROM settings WHERE id = 1');
    const existing = existingResult.rows[0] || {};

    // 2. Merge incoming data with existing data
    const finalApiUrl = apiUrl !== undefined ? apiUrl : existing.api_url;
    const finalModelName = modelName !== undefined ? modelName : existing.model_name;
    const finalApiKey = apiKey !== undefined ? apiKey : existing.api_key;
    const finalDashscopeApiKey = dashscopeApiKey !== undefined ? dashscopeApiKey : existing.dashscope_api_key;

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
    
    const result = await query(sql, [finalApiUrl, finalModelName, finalApiKey, finalDashscopeApiKey]);
    const parsed = SettingsSchema.parse(result.rows[0]);

    // Clear the in-memory cache so next request picks up new settings
    clearConfigCache();
    
    logger.info('Settings updated successfully', { 
      hasDashscopeKey: !!parsed.dashscope_api_key 
    });

    return NextResponse.json({
      apiUrl: parsed.api_url,
      modelName: parsed.model_name,
      apiKey: parsed.api_key,
      dashscopeApiKey: parsed.dashscope_api_key, // Corrected to camelCase naming
    });
  } catch (error) {
    logger.error('Failed to update settings', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
