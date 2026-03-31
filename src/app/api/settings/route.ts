import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { SettingsSchema } from '@/lib/db-schema';
import { clearConfigCache } from '@/lib/llm/client';
import { getConfig } from '@/lib/config/manager';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SettingsAPI');

export async function GET() {
  try {
    const parsed = await getConfig();
    return NextResponse.json({
      apiUrl: parsed.apiUrl,
      modelName: parsed.modelName,
      lightModelName: parsed.lightModelName,
      apiKey: parsed.apiKey,
      dashscopeApiKey: parsed.dashscopeApiKey,
    });
  } catch (error) {
    logger.error('Failed to fetch settings', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiUrl, modelName, lightModelName, apiKey, dashscopeApiKey } = body;

    // 1. Fetch existing settings for merging to avoid destructive updates
    const existingResult = await query('SELECT * FROM settings WHERE id = 1');
    const existing = existingResult.rows[0] || {};

    // 2. Merge incoming data with existing data
    const finalApiUrl = apiUrl !== undefined ? apiUrl : existing.api_url;
    const finalModelName = modelName !== undefined ? modelName : existing.model_name;
    const finalLightModelName = lightModelName !== undefined ? lightModelName : existing.light_model_name;
    const finalApiKey = apiKey !== undefined ? apiKey : existing.api_key;
    const finalDashscopeApiKey = dashscopeApiKey !== undefined ? dashscopeApiKey : existing.dashscope_api_key;

    const sql = `
      INSERT INTO settings (id, api_url, model_name, light_model_name, api_key, dashscope_api_key, updated_at)
      VALUES (1, $1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        api_url = EXCLUDED.api_url,
        model_name = EXCLUDED.model_name,
        light_model_name = EXCLUDED.light_model_name,
        api_key = EXCLUDED.api_key,
        dashscope_api_key = EXCLUDED.dashscope_api_key,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await query(sql, [finalApiUrl, finalModelName, finalLightModelName, finalApiKey, finalDashscopeApiKey]);
    const parsed = SettingsSchema.parse(result.rows[0]);

    // Clear the in-memory cache so next request picks up new settings
    clearConfigCache();
    
    logger.info('Settings updated successfully', { 
      hasDashscopeKey: !!parsed.dashscope_api_key 
    });

    return NextResponse.json({
      apiUrl: parsed.api_url,
      modelName: parsed.model_name,
      lightModelName: parsed.light_model_name,
      apiKey: parsed.api_key,
      dashscopeApiKey: parsed.dashscope_api_key, // Corrected to camelCase naming
    });
  } catch (error) {
    logger.error('Failed to update settings', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
