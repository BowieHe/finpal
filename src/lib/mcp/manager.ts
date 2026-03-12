import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPConfig } from '../../types/mcp';
import { createLogger } from '../logger';
import { getConfig, validateConfig } from '../config/manager';

const logger = createLogger('MCPManager');

export class MCPManager {
  private clients: Map<string, Client> = new Map();

  async getClient(engine: string): Promise<Client> {
    const engineName = engine.toLowerCase();
    
    // 获取配置（会自动验证）
    const validation = await validateConfig();
    if (!validation.valid) {
      throw new Error(validation.message || 'MCP configuration validation failed');
    }
    
    const config = validation.config;

    if (this.clients.has(engineName)) {
      return this.clients.get(engineName)!;
    }

    // Check if API key is configured
    const dashscopeApiKey = config.dashscopeApiKey;
    
    if (!dashscopeApiKey) {
      throw new Error(
        `DASHSCOPE_API_KEY not configured. Please set it in settings or environment variable.`
      );
    }

    const client = new Client({
      name: 'finpal',
      version: '1.0.0',
    });

    // Use StreamableHTTPClientTransport for Bailian MCP
    const mcpUrl = 'https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp';
    const transport = new StreamableHTTPClientTransport(
      new URL(mcpUrl),
      {
        requestInit: {
          headers: {
            'Authorization': `Bearer ${dashscopeApiKey}`,
          },
        },
      }
    );

    await client.connect(transport);

    this.clients.set(engineName, client);
    logger.info(`[MCP Manager] Connected to ${engineName} MCP server`);

    return client;
  }

  async closeAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      logger.info(`[MCP Manager] Closing ${name} connection`);
      await client.close();
    }
    this.clients.clear();
  }
}

export const mcpManager = new MCPManager();
