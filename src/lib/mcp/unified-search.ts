import { mcpManager } from './manager';
import { SearchResult, PLACEHOLDER_RESULT } from '../../types/mcp';

interface Tool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface ToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

export const unifiedSearch = async (
  query: string
): Promise<SearchResult> => {
  const startTime = Date.now();
  
  try {
    const client = await mcpManager.getClient('tavily');
    
    const tools = await client.listTools() as { tools: Tool[] };
    const searchTool = tools.tools.find((t: Tool) => 
      t.name.toLowerCase().includes('search')
    );
    
    if (!searchTool) {
      console.error(`[Unified Search] Search tool not found in tavily MCP`);
      return {
        ...PLACEHOLDER_RESULT,
        query,
        reasoning: 'Tavily MCP 未找到搜索工具（占位符）',
      };
    }
    
    console.log(`[Unified Search] Using tavily for: "${query}"`);
    const searchResult = await client.callTool({
      name: searchTool.name,
      arguments: {
        query,
        max_results: 10,
        search_depth: 'basic',
        include_answer: true,
        include_raw_content: false,
      },
    }) as ToolResult;
    
    const duration = Date.now() - startTime;
    
    return {
      query,
      engine: 'tavily',
      results: searchResult.content || [],
      timestamp: Date.now(),
      reasoning: `Tavily 搜索完成，耗时 ${duration}ms`,
      duration,
    };
    
  } catch (error) {
    console.error(`[Unified Search] Tavily search failed:`, error);
    
    return {
      ...PLACEHOLDER_RESULT,
      query,
      engine: 'tavily',
      reasoning: `Tavily 搜索失败 ${error instanceof Error ? error.message : 'Unknown error'}（占位符）`,
    };
  }
};

export const smartSearch = async (
  query: string
): Promise<SearchResult> => {
  return await unifiedSearch(query);
};
