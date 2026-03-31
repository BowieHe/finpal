'use client';

import ReactMarkdown from 'react-markdown';
import { DebateJudgeState } from '@/types/conversation';

interface RoundDecisionCardProps {
  decision: DebateJudgeState;
  isStreaming?: boolean;
}

export default function RoundDecisionCard({ decision, isStreaming }: RoundDecisionCardProps) {
  const getWinnerInfo = () => {
    switch (decision.winner) {
      case 'optimistic':
        return { emoji: '🐂', label: '多头观点更有力', color: 'emerald' };
      case 'pessimistic':
        return { emoji: '🐻', label: '空头观点更有力', color: 'rose' };
      default:
        return { emoji: '⚖️', label: '双方观点相当', color: 'slate' };
    }
  };

  const getContinueInfo = () => {
    if (decision.isFinal) {
      return { emoji: '🏁', label: '最终裁决', color: 'indigo' };
    }
    return decision.shouldContinue
      ? { emoji: '🔄', label: '进入下一轮辩论', color: 'amber' }
      : { emoji: '✓', label: '辩论结束', color: 'emerald' };
  };

  const winnerInfo = getWinnerInfo();
  const continueInfo = getContinueInfo();

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
      emerald: {
        bg: 'bg-emerald-50/50 dark:bg-emerald-500/5',
        border: 'border-emerald-200 dark:border-emerald-400/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300',
      },
      rose: {
        bg: 'bg-rose-50/50 dark:bg-rose-500/5',
        border: 'border-rose-200 dark:border-rose-400/20',
        text: 'text-rose-700 dark:text-rose-400',
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300',
      },
      slate: {
        bg: 'bg-slate-50/50 dark:bg-slate-500/5',
        border: 'border-slate-200 dark:border-slate-400/20',
        text: 'text-slate-700 dark:text-slate-400',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-400/20 dark:text-slate-300',
      },
      amber: {
        bg: 'bg-amber-50/50 dark:bg-amber-500/5',
        border: 'border-amber-200 dark:border-amber-400/20',
        text: 'text-amber-700 dark:text-amber-400',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300',
      },
      indigo: {
        bg: 'bg-indigo-50/50 dark:bg-indigo-500/5',
        border: 'border-indigo-200 dark:border-indigo-400/20',
        text: 'text-indigo-700 dark:text-indigo-400',
        badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-300',
      },
    };
    return colorMap[color] || colorMap.slate;
  };

  const winnerColors = getColorClasses(winnerInfo.color);
  const continueColors = getColorClasses(continueInfo.color);

  return (
    <div className={`my-6 p-4 rounded-xl border ${winnerColors.bg} ${winnerColors.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚖️</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            第 {decision.round} 轮裁决
          </span>
          {isStreaming && (
            <span className="ml-2 inline-block w-2 h-2 bg-current rounded-full animate-pulse" />
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${continueColors.badge}`}>
          {continueInfo.emoji} {continueInfo.label}
        </span>
      </div>

      {/* Winner */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${winnerColors.badge}`}>
          <span>{winnerInfo.emoji}</span>
          <span className="font-medium text-sm">{winnerInfo.label}</span>
        </div>
      </div>

      {/* Reason */}
      {decision.reason && (
        <div className={`text-sm leading-relaxed ${winnerColors.text}`}>
          <span className="font-medium">裁决理由：</span>
          <ReactMarkdown
            components={{
              p: ({ children }) => <span className="inline">{children}</span>,
            }}
          >
            {decision.reason}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
