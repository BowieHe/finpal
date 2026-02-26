'use client';

interface ResearchResultsProps {
  searchResults: any[];
  researchSummary: any;
  engineUsage: Record<string, number>;
}

export default function ResearchResults({ searchResults, researchSummary, engineUsage }: ResearchResultsProps) {
  return (
    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🔍</span>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex-1">
          信息收集
        </h3>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
          智能路由
        </span>
      </div>
      
      <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          搜索引擎
        </h4>
        <div className="flex items-center gap-3">
          {engineUsage.tavily && engineUsage.tavily > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tavily Search
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {engineUsage.tavily} 次（精细/复杂查询）
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {searchResults.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            搜索路由决策
          </h4>
          {searchResults.map((result, idx) => (
            <div key={idx} className="text-xs p-2 bg-white dark:bg-slate-800 rounded">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                  🎯 Tavily
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {result.query}
                </span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 italic">
                {result.reasoning}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {researchSummary?.key_facts && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
            关键事实
          </h4>
          <ul className="space-y-1">
            {researchSummary.key_facts.map((fact: string, idx: number) => (
              <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {researchSummary?.data_points && researchSummary.data_points.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
            数据来源
          </h4>
          <div className="space-y-2">
            {researchSummary.data_points.map((dp: any, idx: number) => (
              <div key={idx} className="text-sm p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {dp.value}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {dp.source}
                  </span>
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-xs">
                  {dp.context}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {researchSummary?.summary && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
            整体总结
          </h4>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {researchSummary.summary}
          </div>
        </div>
      )}
    </div>
  );
}
