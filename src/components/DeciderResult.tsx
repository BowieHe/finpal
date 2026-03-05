'use client';

import TypewriterText from './TypewriterText';

interface DeciderResultProps {
  winner: string;
  summary: string;
  isStreaming?: boolean;
}

export default function DeciderResult({ winner, summary, isStreaming }: DeciderResultProps) {
  const getWinnerInfo = () => {
    switch (winner) {
      case 'optimistic':
        return { emoji: '😊', label: '乐观派获胜', color: 'emerald' };
      case 'pessimistic':
        return { emoji: '😟', label: '悲观派获胜', color: 'rose' };
      default:
        return { emoji: '⚖️', label: '双方平局', color: 'slate' };
    }
  };

  const info = getWinnerInfo();
  const colorClass = info.color === 'emerald' 
    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-400/20'
    : info.color === 'rose'
    ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-400/20'
    : 'bg-slate-50 border-slate-200 dark:bg-slate-500/10 dark:border-slate-400/20';

  return (
    <div className={`mt-6 p-4 rounded-xl border ${colorClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{info.emoji}</span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {info.label}
        </span>
      </div>
      {summary && (
        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <TypewriterText 
            text={summary} 
            isStreaming={isStreaming}
            speed={20}
          />
        </div>
      )}
    </div>
  );
}