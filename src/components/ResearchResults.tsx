"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  Bot,
  Database,
  Globe,
  LineChart,
  ChevronRight,
  Search,
  Zap,
  Brain,
  FileText,
  ChevronDown,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { EventLogEntry, TimelineEventType } from "@/types/conversation";

interface ResearchResultsProps {
  searchResults: any[];
  allFindings?: any[];
  isSearching?: boolean;
  pendingQueries?: string[];
  dbResults?: any[];
  agentTasks?: Record<string, any>;
  reflections?: Record<number, string>;
  eventHistory?: EventLogEntry[];
}

// 图标映射
const typeIcons: Record<TimelineEventType, React.ElementType> = {
  read: FileText,
  search: Globe,
  db_query: Database,
  thinking: Brain,
  analyze: LineChart,
  skill_call: Bot,
  complete: CheckCircle2,
};

// 颜色映射
const typeColors: Record<TimelineEventType, string> = {
  read: "text-blue-500",
  search: "text-indigo-500",
  db_query: "text-amber-500",
  thinking: "text-purple-500",
  analyze: "text-emerald-500",
  skill_call: "text-cyan-500",
  complete: "text-green-500",
};

// 背景色映射
const typeBgColors: Record<TimelineEventType, string> = {
  read: "bg-blue-500/10",
  search: "bg-indigo-500/10",
  db_query: "bg-amber-500/10",
  thinking: "bg-purple-500/10",
  analyze: "bg-emerald-500/10",
  skill_call: "bg-cyan-500/10",
  complete: "bg-green-500/10",
};

// 状态颜色
const statusColors = {
  running: "bg-amber-400",
  success: "bg-emerald-400",
  error: "bg-rose-500",
};

// 标签映射
const typeLabels: Record<TimelineEventType, string> = {
  read: "读取",
  search: "搜索",
  db_query: "数据库",
  thinking: "思考",
  analyze: "分析",
  skill_call: "调用",
  complete: "完成",
};

export default function ResearchResults({
  searchResults,
  allFindings,
  isSearching,
  pendingQueries = [],
  dbResults = [],
  agentTasks,
  reflections = {},
  eventHistory = [],
}: ResearchResultsProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [showFoundation, setShowFoundation] = useState(false);

  console.log("[ResearchResults] Render", {
    allFindingsCount: allFindings?.length,
    searchResultsCount: searchResults?.length,
    eventHistoryCount: eventHistory?.length,
    isSearching,
  });

  const toggleEvent = (id: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEvents(newExpanded);
  };

  const toggleFinding = (id: string) => {
    const newExpanded = new Set(expandedFindings);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFindings(newExpanded);
  };

  const formatEventTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const formatDuration = (ms?: number) => {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const renderKvList = (items: Array<{ label: string; value: string | number }>) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
        >
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{item.label}</div>
          <div className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">{item.value}</div>
        </div>
      ))}
    </div>
  );

  const renderResearchBoard = (board: any) => (
    <div className="space-y-3">
      {board.proposal && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Research Proposal
          </div>
          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {board.proposal.mainQuestion}
            </div>
            {Array.isArray(board.proposal.subQuestions) && (
              <div className="mt-2 space-y-1">
                {board.proposal.subQuestions.map((question: string, idx: number) => (
                  <div key={`${question}-${idx}`} className="text-xs text-slate-600 dark:text-slate-300">
                    {idx + 1}. {question}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {Array.isArray(board.informationGaps) && board.informationGaps.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Information Gaps
          </div>
          <div className="flex flex-wrap gap-2">
            {board.informationGaps.map((gap: string, idx: number) => (
              <span
                key={`${gap}-${idx}`}
                className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-2.5 py-1 text-[11px]"
              >
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(board.knownFacts) && board.knownFacts.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Known Facts
          </div>
          <div className="space-y-2">
            {board.knownFacts.slice(0, 6).map((fact: any, idx: number) => (
              <div
                key={`${fact.claim}-${idx}`}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3"
              >
                <div className="text-xs font-medium text-slate-800 dark:text-slate-100">{fact.claim}</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 break-all">{fact.source}</div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  可信度 {Math.round((fact.confidence || 0) * 100)}%
                  {fact.gapCovered ? ` · 覆盖 ${fact.gapCovered}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(board.coveredGaps) && board.coveredGaps.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Covered Gaps
          </div>
          <div className="space-y-2">
            {board.coveredGaps.map((item: any, idx: number) => (
              <div
                key={`${item.gap}-${idx}`}
                className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 p-3"
              >
                <div className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                  {item.gap}
                </div>
                <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                  来源查询: {item.query}
                </div>
                {Array.isArray(item.evidence) && item.evidence.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {item.evidence.map((evidence: string, evidenceIdx: number) => (
                      <div
                        key={`${evidence}-${evidenceIdx}`}
                        className="text-[11px] text-emerald-700 dark:text-emerald-300"
                      >
                        {evidenceIdx + 1}. {evidence}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(board.failedPaths) && board.failedPaths.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Failed Paths
          </div>
          <div className="space-y-2">
            {board.failedPaths.map((path: any, idx: number) => (
              <div
                key={`${path.query}-${idx}`}
                className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/20 p-3"
              >
                <div className="text-xs font-medium text-rose-700 dark:text-rose-300">{path.query}</div>
                <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{path.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {board.stopReason && (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
            Stop Reason
          </div>
          <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">{board.stopReason}</div>
        </div>
      )}
    </div>
  );

  const renderCriticReview = (review: any) => (
    <div className="space-y-3">
      {renderKvList([
        { label: "Query", value: review.query || "-" },
        {
          label: "Information Delta",
          value: `${Math.round(((review.informationDelta || 0) as number) * 100)}%`,
        },
        { label: "Accepted", value: review.acceptedResults?.length || 0 },
        { label: "Rejected", value: review.rejectedResults?.length || 0 },
      ])}

      {Array.isArray(review.acceptedResults) && review.acceptedResults.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Accepted Results
          </div>
          <div className="space-y-2">
            {review.acceptedResults.map((item: any, idx: number) => (
              <div
                key={`${item.title}-${idx}`}
                className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 p-3"
              >
                <div className="text-xs font-medium text-emerald-800 dark:text-emerald-200">{item.title}</div>
                {item.url && (
                  <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300 break-all">{item.url}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(review.coveredGaps) && review.coveredGaps.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Gap Coverage
          </div>
          <div className="space-y-2">
            {review.coveredGaps.map((item: any, idx: number) => (
              <div
                key={`${item.gap}-${idx}`}
                className="rounded-md border border-cyan-200 dark:border-cyan-800 bg-cyan-50/70 dark:bg-cyan-950/20 p-3"
              >
                <div className="text-xs font-medium text-cyan-800 dark:text-cyan-200">{item.gap}</div>
                <div className="mt-1 text-[11px] text-cyan-700 dark:text-cyan-300">
                  覆盖度 {Math.round((item.confidence || 0) * 100)}%
                </div>
                {Array.isArray(item.evidence) && item.evidence.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {item.evidence.map((evidence: string, evidenceIdx: number) => (
                      <div
                        key={`${evidence}-${evidenceIdx}`}
                        className="text-[11px] text-cyan-700 dark:text-cyan-300"
                      >
                        {evidenceIdx + 1}. {evidence}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(review.rejectedResults) && review.rejectedResults.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Rejected Results
          </div>
          <div className="space-y-2">
            {review.rejectedResults.map((item: any, idx: number) => (
              <div
                key={`${item.title}-${idx}`}
                className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/20 p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-200">{item.title}</div>
                    <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{item.reason}</div>
                    {item.url && (
                      <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 break-all">{item.url}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Claude Code 风格的时间线渲染
  const renderTimeline = () => {
    if (eventHistory.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            执行时间线
          </h4>
        </div>

        <div className="space-y-1">
          {eventHistory.map((entry, index) => {
            const eventType = entry.type || "thinking";
            const Icon = typeIcons[eventType];
            const colorClass = typeColors[eventType];
            const bgColorClass = typeBgColors[eventType];
            const isExpanded = expandedEvents.has(entry.id);
            const hasContent = entry.expandable && entry.expandedContent;

            return (
              <div key={entry.id} className="relative">
                {/* 连接线 */}
                {index < eventHistory.length - 1 && (
                  <div className="absolute left-[19px] top-8 w-[2px] h-[calc(100%-16px)] bg-slate-200 dark:bg-slate-700" />
                )}

                <div className="flex items-start gap-3 py-1">
                  {/* 图标 */}
                  <div
                    className={`relative z-10 w-10 h-10 rounded-lg ${bgColorClass} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={`w-5 h-5 ${colorClass}`} />
                    {/* 状态指示点 */}
                    {entry.status && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                          statusColors[entry.status] || "bg-slate-400"
                        }`}
                      />
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {typeLabels[eventType]}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatEventTime(entry.timestamp)}
                      </span>
                      {entry.metadata?.durationMs && (
                        <span className="text-[10px] text-slate-400">
                          ({formatDuration(entry.metadata.durationMs)})
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {entry.label}
                      </span>
                    </div>

                    {entry.detail && (
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {entry.detail}
                      </div>
                    )}

                    {/* 展开按钮 */}
                    {hasContent && (
                      <button
                        onClick={() => toggleEvent(entry.id)}
                        className="mt-1 flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-600 transition-colors"
                      >
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                        <span>
                          {isExpanded
                            ? "收起"
                            : `查看详情 ${
                                Array.isArray(entry.expandedContent)
                                  ? `(${entry.expandedContent.length} 条)`
                                  : ""
                              }`}
                        </span>
                      </button>
                    )}

                    {/* 展开内容 */}
                    {isExpanded && hasContent && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        {renderExpandedContent(entry.expandedContent, eventType)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 渲染展开的内容
  const renderExpandedContent = (content: any, type: TimelineEventType) => {
    if (!content) return null;

    if (typeof content === "object" && (content.proposal || content.knownFacts || content.failedPaths || content.stopReason)) {
      return renderResearchBoard(content);
    }

    if (
      typeof content === "object" &&
      "informationDelta" in content &&
      ("acceptedResults" in content || "rejectedResults" in content)
    ) {
      return renderCriticReview(content);
    }

    // 搜索结果显示
    if (type === "search" && Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((result: any, idx: number) => (
            <div
              key={idx}
              className="text-xs p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
            >
              <div className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                {result.title || "搜索结果"}
              </div>
              <div className="text-slate-600 dark:text-slate-400 line-clamp-2">
                {result.snippet || result.description || result.content}
              </div>
              {result.url && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600"
                >
                  <ExternalLink className="w-3 h-3" />
                  {result.url.length > 50
                    ? result.url.slice(0, 50) + "..."
                    : result.url}
                </a>
              )}
            </div>
          ))}
        </div>
      );
    }

    // 思考/分析内容显示
    if (type === "thinking" || type === "analyze") {
      return (
        <div className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
          {typeof content === "string"
            ? content
            : JSON.stringify(content, null, 2)}
        </div>
      );
    }

    // 默认 JSON 显示
    return (
      <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap overflow-auto max-h-60">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  };

  // 将所有 findings 按深度分组
  const findingsByDepth: Record<number, any[]> = {};
  const effectiveFindings =
    allFindings && allFindings.length > 0
      ? allFindings
      : (searchResults || []).map((r) => ({
          query: r.query,
          content:
            r.results
              ?.map(
                (res: any) =>
                  res.snippet || res.description || res.content || res.title
              )
              .join("\n\n") || "正在整理结果...",
          sources:
            r.results?.map((res: any) => res.url || res.link).filter(Boolean) ||
            [],
          depth: 0,
        }));

  effectiveFindings.forEach((f) => {
    const d = f.depth || 0;
    if (!findingsByDepth[d]) findingsByDepth[d] = [];

    const existing = findingsByDepth[d].find((item) => item.query === f.query);
    if (existing) {
      if (f.content && !existing.content.includes(f.content)) {
        existing.content += "\n\n" + f.content;
      }
      if (f.sources) {
        existing.sources = Array.from(
          new Set([...(existing.sources || []), ...f.sources])
        );
      }
    } else {
      findingsByDepth[d].push({ ...f });
    }
  });

  const depths = Object.keys(findingsByDepth)
    .map(Number)
    .sort((a, b) => a - b);

  const hasFoundationTasks =
    !!agentTasks && Object.values(agentTasks).some((t) => !t.id.startsWith("web-"));
  const hasFindings = depths.length > 0;
  const isResearchRunning = Boolean(isSearching || pendingQueries.length > 0);

  // 渲染单个 Finding
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
          <Zap className="text-white w-4 h-4" />
        </div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex-1">
          Deep Search 深度调研
        </h3>
        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded font-medium">
          Iterative Engine
        </span>
      </div>

      {/* Claude Code 风格时间线 */}
      {renderTimeline()}

      <div className="space-y-6">
        {/* 数据底座（可折叠，避免和时间线重复占位） */}
        {hasFoundationTasks && (
          <div className="mb-2">
            <div className="sticky top-2 z-10 flex justify-end mb-2">
              <button
                onClick={() => setShowFoundation((v) => !v)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-400 transition-colors"
              >
                {showFoundation ? "隐藏数据底座" : "显示数据底座"}
              </button>
            </div>

            {showFoundation && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    数据底座与上下文 (Agent Foundation)
                  </h4>
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(agentTasks || {})
                  .filter((t) => !t.id.startsWith("web-"))
                  .map((task) => (
                    <div
                      key={task.id}
                      className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-indigo-600 font-bold text-[10px] flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          {task.name}
                        </div>
                        <div className="flex-1 text-slate-500 dark:text-slate-400 text-[10px] italic truncate">
                          {task.status === "running"
                            ? task.progressMessage || "正在工作中..."
                            : task.resultSummary || "数据检索完毕"}
                        </div>
                        <div className="w-4">
                          {task.status === "running" ? (
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          )}
                        </div>
                      </div>

                      {task.progressLogs &&
                        task.progressLogs.length > 0 &&
                        task.status === "running" && (
                          <div className="text-[9px] text-slate-400 pl-4 border-l border-slate-100 dark:border-slate-800 ml-1">
                            {task.progressLogs[task.progressLogs.length - 1]}
                          </div>
                        )}

                      {task.status === "done" && task.rawResult && (
                        <details className="mt-1 group" open={task.id.startsWith("db-")}>
                          <summary className="text-[9px] cursor-pointer text-indigo-400 hover:text-indigo-500 font-medium select-none flex items-center gap-1">
                            <span className="group-open:rotate-90 transition-transform text-[8px]">
                              ▶
                            </span>
                            数据详情
                          </summary>
                          <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            {task.rawResult.data ? (
                              (() => {
                                const data = task.rawResult.data;
                                const rows = Array.isArray(data)
                                  ? data
                                  : ((Object.values(data).find((v) => Array.isArray(v)) as any[]) ||
                                      null);

                                if (rows && rows.length > 0) {
                                  return (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-[9px] text-slate-600 dark:text-slate-300">
                                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase">
                                          <tr>
                                            {Object.keys(rows[0])
                                              .slice(0, 4)
                                              .map((key) => (
                                                <th
                                                  key={key}
                                                  className="px-1.5 py-1 font-bold"
                                                >
                                                  {key}
                                                </th>
                                              ))}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                          {rows.slice(0, 10).map((row: any, rIdx: number) => (
                                            <tr
                                              key={rIdx}
                                              className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                            >
                                              {Object.keys(rows[0])
                                                .slice(0, 4)
                                                .map((key) => (
                                                  <td
                                                    key={key}
                                                    className="px-1.5 py-1 truncate max-w-40"
                                                  >
                                                    {String(row[key])}
                                                  </td>
                                                ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                }

                                if (typeof data === "object" && data !== null) {
                                  const entries = Object.entries(data).filter(
                                    ([_, v]) => typeof v !== "object" || v === null
                                  );
                                  if (entries.length > 0) {
                                    return (
                                      <div className="grid grid-cols-1 gap-0.5">
                                        {entries.slice(0, 10).map(([k, v]) => (
                                          <div
                                            key={k}
                                            className="flex border-b border-slate-100 dark:border-slate-800 py-0.5"
                                          >
                                            <span className="text-[9px] font-bold text-slate-400 w-20 shrink-0">
                                              {k}:
                                            </span>
                                            <span className="text-[9px] text-slate-600 dark:text-slate-400 truncate">
                                              {String(v)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                }
                                return (
                                  <pre className="text-[9px] font-mono whitespace-pre-wrap">
                                    {JSON.stringify(data, null, 2)}
                                  </pre>
                                );
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
                  ))}
              </div>
              <div className="flex justify-center my-4">
                <div className="h-4 border-l-2 border-dashed border-slate-300 dark:border-slate-700 relative">
                  <ChevronRight className="w-3 h-3 text-slate-300 absolute -bottom-2 -left-1.5 rotate-90" />
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {/* 交互式多轮搜索（状态驱动展示） */}
        {(hasFindings || isResearchRunning) && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                互联网深度下钻 (Iterative Research)
              </h4>
            </div>

            {!hasFindings && isResearchRunning && (
              <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>正在构建研究视图，搜索结果会在到达后分层展示</span>
                </div>
              </div>
            )}

            {depths.map((depth, dIdx) => (
          <div key={`depth-group-${depth}`} className="space-y-4">
            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                  {depth === 0 ? "A" : String.fromCharCode(65 + dIdx * 2)}
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {depth === 0
                    ? "🔍 初步侦察"
                    : `⛏️ 穿透调研 (深度 ${depth})`}
                </h4>
              </div>

              <div className="space-y-2">
                {findingsByDepth[depth].map((f, i) => renderFinding(f, i, depth))}
              </div>
            </div>

            {/* 思考逻辑卡片 */}
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
          </>
        )}
      </div>

      {/* 数据库查询结果 */}
      {dbResults.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" />
            数据库内部查询结果
          </h4>
          {dbResults.map((result, idx) => (
            <div
              key={`db-${idx}`}
              className="text-xs p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 mb-2"
            >
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {result.query}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 正在进行的搜索（保留为底部快捷状态） */}
      {pendingQueries.length > 0 && (
        <div className="mt-6 space-y-2">
          {pendingQueries.map((query, idx) => (
            <div
              key={`pending-${idx}`}
              className="text-xs p-2 bg-white dark:bg-slate-800 rounded border border-indigo-400 animate-pulse flex items-center gap-2"
            >
              <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
              <span className="text-slate-600 dark:text-slate-400">
                正在搜索: {query}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
