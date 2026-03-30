'use client';

import React, { useMemo } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MermaidChart from './MermaidChart';

import { FinalVerdict } from '@/types/conversation';

interface DeciderResultProps {
  winner: string;
  summary: string;
  isStreaming?: boolean;
}

export default function DeciderResult({ winner, summary, isStreaming }: DeciderResultProps) {
  let parsedVerdict: FinalVerdict | null = null;
  try {
    parsedVerdict = JSON.parse(summary);
  } catch (e) {
    // ignore
  }

  const getWinnerInfo = () => {
    switch (winner) {
      case 'optimistic':
        return { emoji: '🐂', label: '多头占优', color: 'emerald' };
      case 'pessimistic':
        return { emoji: '🐻', label: '空头占优', color: 'rose' };
      case 'draw':
        // If it's a direct summary with no valid parsed verdict structure, just say Analysis Conclusion
        if (!parsedVerdict) {
          return { emoji: '💡', label: '智能分析结论', color: 'indigo' };
        }
        return { emoji: '⚖️', label: '多空平衡', color: 'slate' };
      default:
        return { emoji: '💡', label: '智能分析结论', color: 'indigo' };
    }
  };

  const getRecommendationLabel = (rec: string) => {
    switch(rec) {
      case 'strong_buy': return { label: '强烈看多', color: 'bg-emerald-100 text-emerald-800' };
      case 'hold': return { label: '持有观望', color: 'bg-yellow-100 text-yellow-800' };
      case 'reduce': return { label: '建议减仓', color: 'bg-rose-100 text-rose-800' };
      case 'avoid': return { label: '规避风险', color: 'bg-red-100 text-red-800' };
      case 'info_only': return { label: '仅供参考', color: 'bg-slate-100 text-slate-800' };
      default: return { label: rec, color: 'bg-slate-100 text-slate-800' };
    }
  }

  const info = getWinnerInfo();
  const colorClass = info.color === 'emerald' 
    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-400/20'
    : info.color === 'rose'
    ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-400/20'
    : info.color === 'indigo'
    ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-400/20'
    : 'bg-slate-50 border-slate-200 dark:bg-slate-500/10 dark:border-slate-400/20';

  if (!parsedVerdict) {
    return (
      <div className={`mt-6 p-4 rounded-xl border ${colorClass}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{info.emoji}</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {info.label}
          </span>
          {isStreaming && (
            <span className="ml-2 inline-block w-2 h-2 bg-current rounded-full animate-pulse"></span>
          )}
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed overflow-x-auto prose prose-slate dark:prose-invert prose-p:my-1 prose-table:my-2 prose-th:px-2 prose-td:px-2 max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={useMemo(() => ({
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                if (!inline && match && match[1] === 'mermaid') {
                  return <MermaidChart chart={String(children).replace(/\n$/, '')} />;
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }), [])}
          >
            {summary}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  const recInfo = getRecommendationLabel(parsedVerdict.recommendation);

  return (
    <div className={`mt-6 p-5 rounded-xl border ${colorClass} space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{info.emoji}</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            投资建议: {info.label}
          </span>
        </div>
        <div className={`px-3 py-1 text-xs font-bold rounded-full ${recInfo.color}`}>
          {recInfo.label}
        </div>
      </div>

      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 bg-white/50 dark:bg-black/20 p-3 rounded-lg">
        {parsedVerdict.summary}
      </div>

      {parsedVerdict.searchStopReason && (
        <div className="rounded-lg border border-cyan-200 dark:border-cyan-800/60 bg-cyan-50 dark:bg-cyan-900/20 p-3">
          <div className="text-xs font-semibold text-cyan-800 dark:text-cyan-300 mb-1">研究停止依据</div>
          <div className="text-xs text-cyan-700 dark:text-cyan-200">{parsedVerdict.searchStopReason}</div>
        </div>
      )}

      {parsedVerdict.researchBasis && parsedVerdict.researchBasis.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">研究依据</h4>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-disc">
            {parsedVerdict.researchBasis.map((point, idx) => (
              <li key={`basis-${idx}`}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {(parsedVerdict.coveredGaps?.length || parsedVerdict.remainingGaps?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {parsedVerdict.coveredGaps && parsedVerdict.coveredGaps.length > 0 && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <h4 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-2">已覆盖缺口</h4>
              <ul className="text-xs text-emerald-700 dark:text-emerald-200 space-y-1 pl-4 list-disc">
                {parsedVerdict.coveredGaps.map((gap, idx) => (
                  <li key={`covered-${idx}`}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
          {parsedVerdict.remainingGaps && parsedVerdict.remainingGaps.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-3">
              <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">剩余缺口</h4>
              <ul className="text-xs text-amber-700 dark:text-amber-200 space-y-1 pl-4 list-disc">
                {parsedVerdict.remainingGaps.map((gap, idx) => (
                  <li key={`remaining-${idx}`}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parsedVerdict.bullPoints?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">🐂 看多理由</h4>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-disc marker:text-emerald-400">
              {parsedVerdict.bullPoints.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>
        )}
        {parsedVerdict.bearPoints?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-rose-700 dark:text-rose-400">🐻 看空风险</h4>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-disc marker:text-rose-400">
              {parsedVerdict.bearPoints.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {parsedVerdict.comparisonTable && parsedVerdict.comparisonTable.length > 0 && (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-800/50 uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 rounded-tl-lg">标的</th>
                <th className="px-3 py-2">夏普比率</th>
                <th className="px-3 py-2">最大回撤</th>
                <th className="px-3 py-2 rounded-tr-lg">结论</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {parsedVerdict.comparisonTable.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-medium">{row.fundCode}</td>
                  <td className="px-3 py-2">{row.sharpe}</td>
                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400">{row.mdd}%</td>
                  <td className="px-3 py-2">{row.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {parsedVerdict.riskWarnings?.length > 0 && (
        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-lg">
          <h4 className="text-xs font-semibold text-orange-800 dark:text-orange-400 flex items-center gap-1 mb-2">
            <span>⚠️</span> 风险提示
          </h4>
          <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 pl-4 list-disc">
            {parsedVerdict.riskWarnings.map((warning, idx) => (
              <li key={`warn-${idx}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
