'use client';

interface PersonaCardProps {
  emoji: string;
  name: string;
  answer: string;
  thinking?: string;
  theme: 'optimistic' | 'pessimistic';
}

export default function PersonaCard({ emoji, name, answer, theme, thinking }: PersonaCardProps) {
  const isOptimistic = theme === 'optimistic';

  return (
    <div
      className={
        'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm ' +
        (isOptimistic ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500')
      }
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={
            'w-9 h-9 rounded-xl flex items-center justify-center text-xl ' +
            (isOptimistic
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300')
          }
        >
          {emoji}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</h3>
            <span
              className={
                'text-[11px] px-2 py-0.5 rounded-full border ' +
                (isOptimistic
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300')
              }
            >
              {isOptimistic ? 'Opportunity' : 'Risk'}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{isOptimistic ? '更偏积极的视角' : '更偏谨慎的视角'}</div>
        </div>
      </div>

      {thinking && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">思考过程</div>
          <div className="text-sm text-slate-600 dark:text-slate-300 italic border-l-2 border-slate-300 dark:border-slate-600 pl-3">
            {thinking}
          </div>
        </div>
      )}

      <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
        {answer}
      </div>
    </div>
  );
}
