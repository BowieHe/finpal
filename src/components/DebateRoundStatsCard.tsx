'use client';

import { Activity, Gauge, Layers, Scale } from 'lucide-react';
import { DebateRound } from '@/types/conversation';

interface DebateRoundStatsCardProps {
  debateRounds?: DebateRound[];
  status?: 'searching' | 'analyzing' | 'complete' | 'error';
}

function winnerLabel(winner?: 'optimistic' | 'pessimistic' | 'draw') {
  if (winner === 'optimistic') return '多头';
  if (winner === 'pessimistic') return '空头';
  return '平局';
}

function winnerColor(winner?: 'optimistic' | 'pessimistic' | 'draw') {
  if (winner === 'optimistic') return 'text-emerald-600 dark:text-emerald-400';
  if (winner === 'pessimistic') return 'text-rose-600 dark:text-rose-400';
  return 'text-slate-600 dark:text-slate-300';
}

export default function DebateRoundStatsCard({
  debateRounds = [],
  status,
}: DebateRoundStatsCardProps) {
  const decisions = debateRounds
    .map((round) => round.judge)
    .filter((judge): judge is NonNullable<typeof judge> => Boolean(judge));
  const completedDecisions = decisions.filter((d) => !d.pending);
  const pendingDecision = decisions.find((d) => d.pending);
  const latestDecision = completedDecisions[completedDecisions.length - 1];
  const completedRounds = completedDecisions.length;
  const observedRounds = debateRounds.length;

  const inferredCurrentRound = pendingDecision
    ? pendingDecision.round
    : latestDecision?.shouldContinue
      ? completedRounds + 1
      : Math.max(observedRounds, completedRounds, 1);

  const isRunning = status === 'analyzing' || status === 'searching' || Boolean(pendingDecision);
  const stageText = isRunning ? '辩论进行中' : '辩论已结束';
  const nextActionText = latestDecision
    ? latestDecision.shouldContinue
      ? `将进入第 ${latestDecision.round + 1} 轮`
      : '本轮后结束辩论'
    : status === 'complete'
      ? '未收到轮次裁决事件（已使用最终结论）'
      : '等待首轮裁决';

  return (
    <div className="my-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          辩论轮次统计
        </h3>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {stageText}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            当前轮次
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {inferredCurrentRound}
          </div>
        </div>
        <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            已完成裁决
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {completedRounds}
          </div>
        </div>
        <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Scale className="w-3 h-3" />
            最近胜方
          </div>
          <div className={`text-sm font-semibold ${winnerColor(latestDecision?.winner)}`}>
            {winnerLabel(latestDecision?.winner)}
          </div>
        </div>
        <div className="rounded-lg bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700">
          <div className="text-[11px] text-slate-500">轮次走向</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {nextActionText}
          </div>
        </div>
      </div>

      {latestDecision?.reason && (
        <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          <span className="font-semibold">最近裁决理由：</span>
          <span>{latestDecision.reason}</span>
        </div>
      )}
    </div>
  );
}
