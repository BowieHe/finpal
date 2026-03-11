"use client";

import { useState } from "react";

interface ResearchResultsProps {
    searchResults: any[];
    allFindings?: any[];
    researchSummary?: any;
    engineUsage: Record<string, number>;
    isSearching?: boolean;
    pendingQueries?: string[]; // 正在搜索中的查询（显示蓝色框）
    dbResults?: any[]; // Database fetch results
    cioPlanning?: boolean;
    agentTasks?: Record<string, any>;
    finalVerdict?: any;
}

export default function ResearchResults({
    searchResults,
    allFindings,
    researchSummary,
    engineUsage,
    isSearching,
    pendingQueries = [],
    dbResults = [],
    cioPlanning,
    agentTasks,
    finalVerdict,
}: ResearchResultsProps) {
    const [expandedFindings, setExpandedFindings] = useState<Set<number>>(
        new Set(),
    );

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
            <div className="flex items-center gap-3 mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <span className="text-white text-[15px]">🧠</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex-1">
                    CIO 智能分析调度
                </h3>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    Auto-Dispatch
                </span>
            </div>

            {/* Agent 工作流 Timeline */}
            <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shadow-sm border border-slate-300/50 dark:border-slate-600/50">
                        <span className="text-[10px]">🤖</span>
                    </div>
                    <span>Agent 协作流程</span>
                </h4>
                <div className="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    
                    {/* CIO Planning Step */}
                    <div className="flex items-start gap-3">
                        <div className="min-w-20 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            ⚙️ CIO 首脑
                        </div>
                        <div className="flex-1 text-xs text-slate-600 dark:text-slate-400">
                            {cioPlanning ? (
                                <span className="flex items-center gap-2">
                                    <span className="animate-pulse">正在拆解查询，规划调查任务...</span>
                                </span>
                            ) : (
                                <span>任务规划完成</span>
                            )}
                        </div>
                        <div className="text-xs w-5 flex justify-end">
                            {cioPlanning ? <span className="animate-spin inline-block">🔄</span> : '✅'}
                        </div>
                    </div>

                    {/* Agent Tasks */}
                    {agentTasks && Object.values(agentTasks).length > 0 && (
                        <div className="border-l-2 border-slate-100 dark:border-slate-700 ml-5 pl-4 py-2 space-y-3">
                            <div className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-wider">
                                并行执行单元
                            </div>
                            {Object.values(agentTasks).map((task) => (
                                <div key={task.id} className="flex items-start gap-3">
                                    <div className="min-w-25 text-xs font-medium text-indigo-700 dark:text-indigo-400">
                                        {task.name}
                                    </div>
                                    <div className="flex-1 text-xs text-slate-600 dark:text-slate-400">
                                        <div className="font-medium text-slate-800 dark:text-slate-200">
                                            {task.description}
                                        </div>
                                        {task.status === 'running' && task.progressMessage && (
                                            <div className="text-[10px] text-slate-500 mt-0.5 animate-pulse">
                                                {task.progressMessage}
                                            </div>
                                        )}
                                        {task.status === 'done' && task.resultSummary && (
                                            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2" title={task.resultSummary}>
                                                结果: {task.resultSummary}
                                            </div>
                                        )}
                                        {task.status === 'error' && task.error && (
                                            <div className="text-[10px] text-red-500 mt-0.5">
                                                失败: {task.error}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs w-5 flex justify-end">
                                        {task.status === 'running' && <span className="animate-spin inline-block">🔄</span>}
                                        {task.status === 'done' && '✅'}
                                        {task.status === 'error' && '❌'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 搜索引擎统计 */}
            {engineUsage && Object.keys(engineUsage).length > 0 && Object.values(engineUsage).some((v) => Number(v) > 0) && (
                <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                        搜索引擎
                    </h4>
                <div className="flex items-center gap-3 flex-wrap">
                    {engineUsage["bailian-websearch"] &&
                        engineUsage["bailian-websearch"] > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-lg">☁️</span>
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        百炼搜索
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {engineUsage["bailian-websearch"]} 次
                                    </div>
                                </div>
                            </div>
                        )}
                </div>
            </div>
            )}

            {/* 研究发现 - 整合数据来源，可折叠 */}
            {allFindings && allFindings.length > 0 && (
                <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        研究发现 ({allFindings.length})
                    </h4>
                    {allFindings.map((finding: any, idx: number) => (
                        <div
                            key={idx}
                            className="text-xs bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
                        >
                            {/* 头部 - 始终显示 */}
                            <div
                                className="p-2 flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                onClick={() => toggleFinding(idx)}
                            >
                                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 shrink-0">
                                    深度 {finding.depth}
                                </span>
                                <span
                                    className="font-medium text-slate-700 dark:text-slate-300 truncate flex-1"
                                    title={finding.query}
                                >
                                    {finding.query}
                                </span>
                                <span className="text-slate-400">
                                    {expandedFindings.has(idx) ? "▼" : "▶"}
                                </span>
                            </div>

                            {/* 展开内容 */}
                            {expandedFindings.has(idx) && (
                                <div className="border-t border-slate-200 dark:border-slate-700">
                                    {/* 研究发现内容 */}
                                    <div className="p-2 text-slate-600 dark:text-slate-400 whitespace-pre-wrap style-wrap-break-word">
                                        {finding.content}
                                    </div>

                                    {/* 数据来源 */}
                                    {finding.sources &&
                                        finding.sources.length > 0 && (
                                            <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                                <div className="text-[10px] text-slate-500 mb-1">
                                                    数据来源:
                                                </div>
                                                <div className="space-y-1">
                                                    {finding.sources
                                                        .slice(0, 5)
                                                        .map(
                                                            (
                                                                source: string,
                                                                sidx: number,
                                                            ) => (
                                                                <a
                                                                    key={sidx}
                                                                    href={
                                                                        source
                                                                    }
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="block text-[10px] text-indigo-600 hover:text-indigo-800 truncate"
                                                                    title={
                                                                        source
                                                                    }
                                                                >
                                                                    {source}
                                                                </a>
                                                            ),
                                                        )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 数据库查询结果 */}
            {dbResults.length > 0 && (
                <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>💾</span> 数据库内部查询 ({dbResults.length})
                    </h4>
                    {dbResults.map((result, idx) => (
                        <div
                            key={`db-${idx}`}
                            className="text-xs p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-200 dark:border-indigo-800"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium">
                                    {result.type}
                                </span>
                                <span
                                    className="font-semibold text-slate-800 dark:text-slate-200 truncate"
                                    title={result.query}
                                >
                                    {result.query}
                                </span>
                                {result.status && (
                                    <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded ${result.status === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                                    >
                                        {result.status}
                                    </span>
                                )}
                            </div>

                            {result.results && result.results.length > 0 && (
                                <div className="mt-2 space-y-1.5 border-t border-indigo-100 dark:border-indigo-800/50 pt-2">
                                    {result.results.map(
                                        (item: any, iidx: number) => (
                                            <div
                                                key={iidx}
                                                className="p-2 bg-white dark:bg-slate-800/50 rounded shadow-sm"
                                            >
                                                {item.title && (
                                                    <div className="font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                                                        {item.title}
                                                    </div>
                                                )}
                                                <p className="text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
                                                    {item.description ||
                                                        item.snippet ||
                                                        JSON.stringify(item)}
                                                </p>
                                            </div>
                                        ),
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 普通搜索结果 */}
            {(searchResults.length > 0 || pendingQueries.length > 0) && (
                <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        搜索结果 ({searchResults.length + pendingQueries.length}
                        )
                    </h4>
                    {/* 正在搜索中的查询（蓝色框，带闪烁） */}
                    {pendingQueries.map((query, idx) => (
                        <div
                            key={`pending-${idx}`}
                            className="text-xs p-2 bg-white dark:bg-slate-800 rounded border border-indigo-400 animate-pulse"
                        >
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                    搜索
                                </span>
                                <span
                                    className="font-medium text-slate-700 dark:text-slate-300 truncate"
                                    title={query}
                                >
                                    {query}
                                </span>
                                <span className="text-[10px] text-indigo-600 animate-pulse">
                                    搜索中...
                                </span>
                            </div>
                        </div>
                    ))}
                    {/* 已完成的搜索结果（蓝色框 + 绿色框） */}
                    {searchResults.map((result, idx) => (
                        <div
                            key={idx}
                            className="text-xs p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                    {result.engine === "bailian-websearch"
                                        ? "百炼搜索"
                                        : result.engine || "搜索"}
                                </span>
                                <span
                                    className="font-medium text-slate-700 dark:text-slate-300 truncate"
                                    title={result.query}
                                >
                                    {result.query}
                                </span>
                            </div>
                            {result.results && result.results.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {result.results
                                        .slice(0, 3)
                                        .map((item: any, iidx: number) => (
                                            <div
                                                key={iidx}
                                                className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded"
                                            >
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block text-indigo-600 hover:underline truncate"
                                                    title={item.title}
                                                >
                                                    {item.title}
                                                </a>
                                                <p className="text-slate-500 line-clamp-2 mt-0.5">
                                                    {item.description ||
                                                        item.snippet}
                                                </p>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 关键事实 */}
            {researchSummary?.key_facts &&
                researchSummary.key_facts.length > 0 && (
                    <div className="mb-4">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                            关键事实
                        </h4>
                        <ul className="space-y-2">
                            {researchSummary.key_facts.map(
                                (fact: string, idx: number) => (
                                    <li
                                        key={idx}
                                        className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2"
                                    >
                                        <span className="text-blue-500 shrink-0">
                                            •
                                        </span>
                                        <span className="style-wrap-break-word">
                                            {fact}
                                        </span>
                                    </li>
                                ),
                            )}
                        </ul>
                    </div>
                )}

            {/* 移除整体总结部分 */}
        </div>
    );
}
