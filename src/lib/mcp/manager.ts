import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPConfig } from '../../types/mcp';
import { createLogger } from '../logger';
import { getConfig, validateConfig } from '../config/manager';

const logger = createLogger('MCPManager');

export class MCPManager {
  private clients: Map<string, Client> = new Map();

  async getClient(engine: string): Promise<Client> {
    const engineName = engine.toLowerCase();
    
    if (this.clients.has(engineName)) {
      return this.clients.get(engineName)!;
    }

    // 获取配置（会自动验证）
    const validation = await validateConfig();
    if (!validation.valid) {
      throw new Error(validation.message || 'MCP configuration validation failed');
    }
    
    const config = validation.config;

    const client = new Client({
      name: 'finpal',
      version: '1.0.0',
    });

    let transport;

    if (engineName === 'playwright') {
      logger.info('[MCP Manager] Connecting to Playwright MCP via Stdio');
      transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-playwright'],
      });
    } else {
      // Check if API key is configured
      const dashscopeApiKey = config.dashscopeApiKey;
      
      if (!dashscopeApiKey) {
        throw new Error(
          `DASHSCOPE_API_KEY not configured. Please set it in settings or environment variable.`
        );
      }

      // Use StreamableHTTPClientTransport for Bailian MCP
      const mcpUrl = 'https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp';
      transport = new StreamableHTTPClientTransport(
        new URL(mcpUrl),
        {
          requestInit: {
            headers: {
              'Authorization': `Bearer ${dashscopeApiKey}`,
            },
          },
        }
      );
    }

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
