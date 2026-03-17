"use client";

import { useState } from "react";
import { 
    Loader2, 
    CheckCircle2, 
    XCircle, 
    Settings, 
    Bot, 
    Database, 
    Globe, 
    LineChart,
    ChevronRight,
    Search,
    MessageSquare,
    Zap
} from "lucide-react";

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
    reflections?: Record<number, string>; // 新增：深度思考逻辑
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
    reflections = {},
}: ResearchResultsProps) {
    const [expandedFindings, setExpandedFindings] = useState<Set<string>>(
        new Set(),
    );

    console.log('[ResearchResults] Render', { 
        allFindingsCount: allFindings?.length, 
        searchResultsCount: searchResults?.length,
        isSearching 
    });

    const toggleFinding = (id: string) => {
        const newExpanded = new Set(expandedFindings);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedFindings(newExpanded);
    };

    // 将 findings 按深度分组，并按查询内容去重/聚合
    const findingsByDepth: Record<number, any[]> = {};
    
    // 如果没有 allFindings，则从 searchResults 中提取作为初步侦察 (Depth 0)
    const effectiveFindings = (allFindings && allFindings.length > 0) 
        ? allFindings 
        : (searchResults || []).map(r => ({
            query: r.query,
            content: r.results?.map((res: any) => res.snippet || res.description || res.content || res.title).join("\n\n") || "正在整理结果...",
            sources: r.results?.map((res: any) => res.url || res.link).filter(Boolean) || [],
            depth: 0
        }));

    effectiveFindings.forEach(f => {
        const d = f.depth || 0;
        if (!findingsByDepth[d]) findingsByDepth[d] = [];
        
        // 检查该深度下是否已经存在相同查询的 Finding
        const existing = findingsByDepth[d].find(item => item.query === f.query);
        if (existing) {
            // 如果存在，合并内容（如果不同）和来源
            if (f.content && !existing.content.includes(f.content)) {
                existing.content += "\n\n" + f.content;
            }
            if (f.sources) {
                existing.sources = Array.from(new Set([...(existing.sources || []), ...f.sources]));
            }
        } else {
            // 深度克隆以避免修改原始数据
            findingsByDepth[d].push({ ...f });
        }
    });

    // 获取所有存在的深度并排序
    const depths = Object.keys(findingsByDepth).map(Number).sort((a, b) => a - b);

    // 渲染单项 Finding
    const renderFinding = (finding: any, idx: number, depth: number) => {
        const id = `finding-${depth}-${idx}`;
        return (
            <div
                key={id}
                className="text-xs bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
                <div
                    className="p-2 flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => toggleFinding(id)}
                >
                    <Search className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span
                        className="font-medium text-slate-700 dark:text-slate-300 truncate flex-1"
                        title={finding.query}
                    >
                        {finding.query}
                    </span>
                    <span className="text-slate-400">
                        {expandedFindings.has(id) ? "▼" : "▶"}
                    </span>
                </div>

                {expandedFindings.has(id) && (
                    <div className="border-t border-slate-200 dark:border-slate-700">
                        <div className="p-2 text-slate-600 dark:text-slate-400 whitespace-pre-wrap style-wrap-break-word leading-relaxed">
                            {finding.content}
                        </div>
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
        );
    };

    return (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl max-w-full overflow-x-auto">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                    <Zap className="text-white w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex-1">
                    Deep Search 深度调研
                </h3>
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded font-medium">
                    Iterative Engine
                </span>
            </div>

            <div className="space-y-6">
                {/* 1. 数据底座 (Foundational Agents) - Holdings, DB, Quant results */}
                {agentTasks && Object.values(agentTasks).some(t => !t.id.startsWith('web-')) && (
                     <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                             <Database className="w-3.5 h-3.5 text-slate-400" />
                             <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">数据底座与上下文 (Agent Foundation)</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                             {Object.values(agentTasks)
                                .filter(t => !t.id.startsWith('web-'))
                                .map((task) => (
                                    <div key={task.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="text-indigo-600 font-bold text-[10px] flex items-center gap-1">
                                                <Bot className="w-3 h-3" />
                                                {task.name}
                                            </div>
                                            <div className="flex-1 text-slate-500 dark:text-slate-400 text-[10px] italic truncate">
                                                {task.status === "running" ? (task.progressMessage || "正在工作中...") : (task.resultSummary || "数据检索完毕")}
                                            </div>
                                            <div className="w-4">
                                                {task.status === "running" ? <Loader2 className="w-3 h-3 animate-spin text-indigo-500" /> : <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                            </div>
                                        </div>

                                        {/* 过程日志 (缩减版) */}
                                        {task.progressLogs && task.progressLogs.length > 0 && task.status === "running" && (
                                            <div className="text-[9px] text-slate-400 pl-4 border-l border-slate-100 dark:border-slate-800 ml-1">
                                                {task.progressLogs[task.progressLogs.length - 1]}
                                            </div>
                                        )}

                                        {/* 核心结果详情 */}
                                        {task.status === "done" && task.rawResult && (
                                            <details className="mt-1 group" open={task.id.startsWith("db-")}>
                                                <summary className="text-[9px] cursor-pointer text-indigo-400 hover:text-indigo-500 font-medium select-none flex items-center gap-1">
                                                    <span className="group-open:rotate-90 transition-transform text-[8px]">▶</span>
                                                    数据详情
                                                </summary>
                                                <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                                    {task.rawResult.data ? (
                                                        (() => {
                                                            const data = task.rawResult.data;
                                                            const rows = Array.isArray(data) ? data : 
                                                                       (Object.values(data).find(v => Array.isArray(v)) as any[]) || null;
                                                            
                                                            if (rows && rows.length > 0) {
                                                                return (
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-left text-[9px] text-slate-600 dark:text-slate-300">
                                                                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase">
                                                                                <tr>
                                                                                    {Object.keys(rows[0]).slice(0, 4).map(key => (
                                                                                        <th key={key} className="px-1.5 py-1 font-bold">{key}</th>
                                                                                    ))}
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                                                {rows.slice(0, 10).map((row: any, rIdx: number) => (
                                                                                    <tr key={rIdx} className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                                                                        {Object.keys(rows[0]).slice(0, 4).map(key => (
                                                                                            <td key={key} className="px-1.5 py-1 truncate max-w-40">{String(row[key])}</td>
                                                                                        ))}
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                );
                                                            }
                                                            
                                                            if (typeof data === 'object' && data !== null) {
                                                                const entries = Object.entries(data).filter(([_, v]) => typeof v !== 'object' || v === null);
                                                                if (entries.length > 0) {
                                                                    return (
                                                                        <div className="grid grid-cols-1 gap-0.5">
                                                                            {entries.slice(0, 10).map(([k, v]) => (
                                                                                <div key={k} className="flex border-b border-slate-100 dark:border-slate-800 py-0.5">
                                                                                    <span className="text-[9px] font-bold text-slate-400 w-20 shrink-0">{k}:</span>
                                                                                    <span className="text-[9px] text-slate-600 dark:text-slate-400 truncate">{String(v)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                }
                                                            }
                                                            return <pre className="text-[9px] font-mono whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
                                                        })()
                                                    ) : (
                                                        <pre className="text-[9px] font-mono whitespace-pre-wrap text-slate-500">
                                                            {JSON.stringify(task.rawResult, null, 2)}
                                                        </pre>
                                                    )}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                ))
                             }
                        </div>
                        <div className="flex justify-center my-4">
                            <div className="h-4 border-l-2 border-dashed border-slate-300 dark:border-slate-700 relative">
                                <ChevronRight className="w-3 h-3 text-slate-300 absolute -bottom-2 -left-1.5 rotate-90" />
                            </div>
                        </div>
                     </div>
                )}

                {/* 2. 交互式多轮搜索 (Iterative Research) */}
                <div className="flex items-center gap-2 mb-3">
                     <Globe className="w-3.5 h-3.5 text-slate-400" />
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">互联网深度下钻 (Iterative Research)</h4>
                </div>
                {depths.map((depth, dIdx) => (
                    <div key={`depth-group-${depth}`} className="space-y-4">
                        {/* 调研卡片 (Probe/Deep Dive) */}
                        <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                                    {depth === 0 ? "A" : String.fromCharCode(65 + dIdx * 2)}
                                </div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    {depth === 0 ? "🔍 初步侦察" : `⛏️ 穿透调研 (深度 ${depth})`}
                                </h4>
                            </div>
                            
                            <div className="space-y-2">
                                {findingsByDepth[depth].map((f, i) => renderFinding(f, i, depth))}
                            </div>
                        </div>

                        {/* 思考逻辑卡片 (Reflect) */}
                        {reflections[depth] !== undefined && (
                            <div className="bg-slate-100/50 dark:bg-slate-800/30 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 relative ml-4">
                                <div className="absolute top-0 -left-4 w-4 h-1/2 border-l-2 border-b-2 border-slate-200 dark:border-slate-700 rounded-bl-xl" />
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xs font-bold">
                                        {depth === 0 ? "B" : String.fromCharCode(65 + dIdx * 2 + 1)}
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                        🧠 深度思考与路径规划
                                    </h4>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-serif italic">
                                    {reflections[depth]}
                                    {isSearching && !reflections[depth] && (
                                        <span className="animate-pulse">思考中...</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 数据库查询结果 */}
            {dbResults.length > 0 && (
                <div className="mt-6">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                        <span>💾</span> 数据库内部查询结果
                    </h4>
                    {dbResults.map((result, idx) => (
                        <div
                            key={`db-${idx}`}
                            className="text-xs p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-200 dark:border-indigo-800 mb-2"
                        >
                            {/* ... (保持原有数据库结果显示逻辑简单化) */}
                            <div className="font-medium text-slate-800 dark:text-slate-200">{result.query}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* 普通搜索结果 (正在进行的) */}
            {pendingQueries.length > 0 && (
                <div className="mt-6 space-y-2">
                    {pendingQueries.map((query, idx) => (
                        <div
                            key={`pending-${idx}`}
                            className="text-xs p-2 bg-white dark:bg-slate-800 rounded border border-indigo-400 animate-pulse flex items-center gap-2"
                        >
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                            <span className="text-slate-600 dark:text-slate-400">正在下钻: {query}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
