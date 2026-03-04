'use client';

interface SearchResultItem {
  title: string;
  snippet?: string;
  url?: string;
}

interface SearchResult {
  query: string;
  results: SearchResultItem[];
}

interface ResearchProgressProps {
  status: 'planning' | 'searching' | 'analyzing' | 'complete';
  currentQuery?: string;
  findingsCount?: number;
  totalQueries?: number;
  currentDepth?: number;
  maxDepth?: number;
  searchResults?: SearchResult[];
}

export default function ResearchProgress({
  status,
  currentQuery,
  findingsCount = 0,
  totalQueries = 0,
  currentDepth = 0,
  maxDepth = 0,
  searchResults = [],
}: ResearchProgressProps) {
  const getStatusText = () => {
    switch (status) {
      case 'planning':
        return '正在规划研究路径...';
      case 'searching':
        return currentQuery 
          ? `正在搜索: ${currentQuery}` 
          : `正在搜索中... (${findingsCount}/${totalQueries})`;
      case 'analyzing':
        return '正在分析研究发现...';
      case 'complete':
        return '研究完成';
      default:
        return '准备中...';
    }
  };

  const getProgressPercent = () => {
    if (totalQueries === 0) return status === 'planning' ? 10 : 50;
    if (status === 'complete') return 100;
    return Math.min(90, (findingsCount / totalQueries) * 100);
  };

  return (
    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
            <span className="text-xl">🔬</span>
          </div>
          {status !== 'complete' && (
            <div className="absolute inset-0 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Deep Research
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {getStatusText()}
          </p>
        </div>
        {status === 'complete' && (
          <span className="text-green-600 dark:text-green-400 text-sm font-medium">
            ✓ 完成
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-3">
        <div 
          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${getProgressPercent()}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        {maxDepth > 0 && (
          <span>
            深度: {currentDepth}/{maxDepth}
          </span>
        )}
        {totalQueries > 0 && (
          <span>
            查询: {findingsCount}/{totalQueries}
          </span>
        )}
        {searchResults.length > 0 && (
          <span>
            已搜索: {searchResults.length} 个查询
          </span>
        )}
      </div>

      {/* Search Results Timeline */}
      {searchResults.length > 0 && (
        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
          {searchResults.map((result, index) => (
            <div key={index} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  搜索 {index + 1}
                </span>
                <span className="text-xs text-slate-500 truncate flex-1">{result.query}</span>
              </div>
              
              {result.results.length > 0 ? (
                <div className="space-y-2">
                  {result.results.map((item, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded text-xs">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline block mb-1"
                      >
                        {item.title}
                      </a>
                      <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                        {item.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">暂无搜索结果</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
