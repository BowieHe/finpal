import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPConfig } from '../../types/mcp';

// MCP 服务器配置
export const MCP_SERVERS: Record<string, MCPConfig> = {
  'open-websearch': {
    name: 'open-websearch',
    command: 'npx',
    args: ['-y', '@zhsunlight/open-websearch-mcp@latest'],
    env: {
      HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '',
      HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
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

    const client = new Client({
      name: 'finpal',
      version: '1.0.0',
    });

    const defaultEnv = getDefaultEnvironment();
    const transportEnv = {
      ...defaultEnv,
      ...config.env,
    };

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: transportEnv,
    });

    await client.connect(transport);

    this.clients.set(engineName, client);
    console.log(`[MCP Manager] Connected to ${engineName} MCP server`);

    return client;
  }

  async closeAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      console.log(`[MCP Manager] Closing ${name} connection`);
      await client.close();
    }
    this.clients.clear();
  }
}

export const mcpManager = new MCPManager();
