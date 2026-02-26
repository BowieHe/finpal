import { SearchEngine } from '../../types/mcp';

export function chooseSearchEngine(query: string): {
  engine: SearchEngine;
  reasoning: string;
} {
  return {
    engine: 'tavily',
    reasoning: '使用 Tavily 搜索',
  };
}
