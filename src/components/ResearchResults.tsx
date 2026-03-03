'use client';

interface ResearchResultsProps {
  searchResults: any[];
  allFindings?: any[];
  researchSummary: any;
  engineUsage: Record<string, number>;
  isDeepResearch?: boolean;
}

export default function ResearchResults({ searchResults, allFindings, researchSummary, engineUsage, isDeepResearch }: ResearchResultsProps) {
  const hasFindings = (allFindings && allFindings.length > 0) || (searchResults && searchResults.length > 0);

  return (
    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{isDeepResearch ? '🔬' : '🔍'}</span>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex-1">
          {isDeepResearch ? '深度研究' : '信息收集'}
        </h3>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
          {isDeepResearch ? 'Deep Research' : '智能路由'}
        </span>
      </div>

      <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          搜索引擎
        </h4>
        <div className="flex items-center gap-3 flex-wrap">
          {engineUsage.openwebsearch && engineUsage.openwebsearch > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg">🌐</span>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Open WebSearch
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {engineUsage.openwebsearch} 次
                </div>
              </div>
            </div>
          )}
          {engineUsage.duckduckgo && engineUsage.duckduckgo > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg">🦆</span>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  DuckDuckGo
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {engineUsage.duckduckgo} 次
                </div>
              </div>
            </div>
          )}
          {engineUsage['aliyun-websearch'] && engineUsage['aliyun-websearch'] > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg">☁️</span>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  阿里云 Web Search
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {engineUsage['aliyun-websearch']} 次
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DeepResearch findings */}
      {isDeepResearch && allFindings && allFindings.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            研究发现 ({allFindings.length})
          </h4>
          {allFindings.map((finding: any, idx: number) => (
            <div key={idx} className="text-xs p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  深度 {finding.depth}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {finding.query}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 line-clamp-3">
                {finding.content}
              </div>
              {finding.sources && finding.sources.length > 0 && (
                <div className="mt-1 flex gap-1 flex-wrap">
                  {finding.sources.map((source: string, sidx: number) => (
                    <span key={sidx} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500">
                      来源 {sidx + 1}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Regular search results */}
      {!isDeepResearch && searchResults.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            搜索路由决策
          </h4>
          {searchResults.map((result, idx) => (
            <div key={idx} className="text-xs p-2 bg-white dark:bg-slate-800 rounded">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  🔍 {result.engine === 'open-websearch' ? 'WebSearch' : result.engine}
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
