'use client';

import { useState } from 'react';

interface ResearchResultsProps {
  searchResults: any[];
  allFindings?: any[];
  researchSummary?: any;
  engineUsage: Record<string, number>;
  isDeepResearch?: boolean;
  isSearching?: boolean;
}

export default function ResearchResults({ searchResults, allFindings, researchSummary, engineUsage, isDeepResearch, isSearching }: ResearchResultsProps) {
  const hasFindings = (allFindings && allFindings.length > 0) || (searchResults && searchResults.length > 0);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());

  const toggleFinding = (idx: number) => {
    const newExpanded = new Set(expandedFindings);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedFindings(newExpanded);
  };

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

      {/* 搜索引擎统计 */}
      <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          搜索引擎
        </h4>
        <div className="flex items-center gap-3 flex-wrap">
          {engineUsage['bailian-websearch'] && engineUsage['bailian-websearch'] > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg">☁️</span>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  百炼搜索
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {engineUsage['bailian-websearch']} 次
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 研究发现 - 整合数据来源，可折叠 */}
      {isDeepResearch && allFindings && allFindings.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            研究发现 ({allFindings.length})
          </h4>
          {allFindings.map((finding: any, idx: number) => (
            <div key={idx} className="text-xs bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* 头部 - 始终显示 */}
              <div 
                className="p-2 flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                onClick={() => toggleFinding(idx)}
              >
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 flex-shrink-0">
                  深度 {finding.depth}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate flex-1" title={finding.query}>
                  {finding.query}
                </span>
                <span className="text-slate-400">
                  {expandedFindings.has(idx) ? '▼' : '▶'}
                </span>
              </div>
              
              {/* 展开内容 */}
              {expandedFindings.has(idx) && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                  {/* 研究发现内容 */}
                  <div className="p-2 text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">
                    {finding.content}
                  </div>
                  
                  {/* 数据来源 */}
                  {finding.sources && finding.sources.length > 0 && (
                    <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-500 mb-1">数据来源:</div>
                      <div className="space-y-1">
                        {finding.sources.slice(0, 5).map((source: string, sidx: number) => (
                          <a 
                            key={sidx}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[10px] text-indigo-600 hover:text-indigo-800 truncate"
                            title={source}
                          >
                            {source}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 普通搜索结果 */}
      {searchResults.length > 0 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            搜索结果 ({searchResults.length})
          </h4>
          {searchResults.map((result, idx) => (
            <div key={idx} className={`text-xs p-2 bg-white dark:bg-slate-800 rounded border ${isSearching && idx === searchResults.length - 1 ? 'border-indigo-400 animate-pulse' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  {result.engine === 'bailian-websearch' ? '百炼搜索' : result.engine || '搜索'}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate" title={result.query}>
                  {result.query}
                </span>
                {isSearching && idx === searchResults.length - 1 && (
                  <span className="text-[10px] text-indigo-600 animate-pulse">搜索中...</span>
                )}
              </div>
              {result.results && result.results.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.results.slice(0, 3).map((item: any, iidx: number) => (
                    <div key={iidx} className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded">
                      <a 
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-indigo-600 hover:underline truncate"
                        title={item.title}
                      >
                        {item.title}
                      </a>
                      <p className="text-slate-500 line-clamp-2 mt-0.5">{item.description || item.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 关键事实 */}
      {researchSummary?.key_facts && researchSummary.key_facts.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
            关键事实
          </h4>
          <ul className="space-y-2">
            {researchSummary.key_facts.map((fact: string, idx: number) => (
              <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-blue-500 flex-shrink-0">•</span>
                <span className="break-words">{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 移除整体总结部分 */}
    </div>
  );
}
