import { config } from 'dotenv';
config({ path: '.env.local' });

import { mcpManager } from './src/lib/mcp/manager.js';

async function testTavily() {
  console.log('Starting Tavily MCP test...');
  console.log('TAVILY_API_KEY:', process.env.TAVILY_API_KEY ? 'configured' : 'missing');
  console.log('TAVILY_API_KEY value:', process.env.TAVILY_API_KEY?.substring(0, 10) + '...');
  
  try {
    const client = await mcpManager.getClient('tavily');
    console.log('Connected to Tavily MCP server');
    
    const tools = await client.listTools() as { tools: { name: string; description?: string }[] };
    console.log('Available tools:', tools.tools.map(t => t.name));
    
    const searchResult = await client.callTool({
      name: 'tavily_search',
      arguments: {
        query: 'What is the weather today?',
        max_results: 3,
      },
    });
    
    console.log('Search result:', JSON.stringify(searchResult, null, 2));
    
    await mcpManager.closeAll();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testTavily();