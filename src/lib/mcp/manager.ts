import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPConfig } from '../../types/mcp';
import { createLogger } from '../logger';

const logger = createLogger('MCPManager');

// MCP 服务器配置
export const MCP_SERVERS: Record<string, MCPConfig> = {
  'bailian-websearch': {
    name: 'bailian-websearch',
    url: 'https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp',
    headers: {
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY || ''}`,
    },
  },
};

export class MCPManager {
  private clients: Map<string, Client> = new Map();

  async getClient(engine: string): Promise<Client> {
    const engineName = engine.toLowerCase() as keyof typeof MCP_SERVERS;
    const config = MCP_SERVERS[engineName];

    if (!config) {
      throw new Error(`MCP server ${engineName} not found`);
    }

    if (this.clients.has(engineName)) {
      return this.clients.get(engineName)!;
    }

    // Check if API key is configured (from global or env)
    const dashscopeApiKey = (global as any).DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY;
    
    if (!config.url) {
      throw new Error(`MCP server ${engineName} URL not configured`);
    }

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
    const transport = new StreamableHTTPClientTransport(
      new URL(config.url),
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
