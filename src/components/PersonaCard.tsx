'use client';

interface PersonaCardProps {
  emoji: string;
  name: string;
  answer: string;
  rebuttal?: string;
  theme: 'optimistic' | 'pessimistic';
}

export default function PersonaCard({ emoji, name, answer, rebuttal, theme }: PersonaCardProps) {
  const isOptimistic = theme === 'optimistic';
  const borderColor = isOptimistic ? 'border-l-emerald-500' : 'border-l-rose-500';
  const bgColor = isOptimistic 
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  const badgeColor = isOptimistic
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300';

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm border-l-4 ${borderColor}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl ${bgColor}`}>
          {emoji}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {isOptimistic ? 'Opportunity' : 'Risk'}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isOptimistic ? '更偏积极的视角' : '更偏谨慎的视角'}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">初始观点</div>
          <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {answer}
          </div>
        </div>

        {rebuttal && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              反驳观点
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-300 dark:border-slate-600">
              {rebuttal}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}