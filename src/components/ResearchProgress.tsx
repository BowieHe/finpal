'use client';

interface ResearchProgressProps {
  status: 'planning' | 'searching' | 'analyzing' | 'complete';
  currentQuery?: string;
  findingsCount?: number;
  totalQueries?: number;
  currentDepth?: number;
  maxDepth?: number;
}

export default function ResearchProgress({
  status,
  currentQuery,
  findingsCount = 0,
  totalQueries = 0,
  currentDepth = 0,
  maxDepth = 0,
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
        {findingsCount > 0 && (
          <span>
            已发现: {findingsCount} 条结果
          </span>
        )}
      </div>

      {/* Current query detail */}
      {currentQuery && status === 'searching' && (
        <div className="mt-3 p-2 bg-white dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 truncate">
          <span className="text-indigo-600 dark:text-indigo-400">当前:</span> {currentQuery}
        </div>
      )}
    </div>
  );
}
