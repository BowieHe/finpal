"use client";

import { useState, useEffect, useRef } from "react";
import ChatInput from "@/components/ChatInput";
import MessageList from "@/components/MessageList";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import PersonaModal from "@/components/PersonaModal";
import AddHoldingModal, { HoldingData } from "@/components/AddHoldingModal";
import ThemeToggle from "@/components/ThemeToggle";
import { Conversation, Message, EventLogEntry } from "@/types/conversation";
import { LLMConfig, Theme } from "@/types/config";
import {
    getConversations,
    getCurrentConversation,
    createNewConversation,
    setCurrentConversationId,
    deleteConversation,
    addMessageToConversation,
    updateMessageInConversation,
    updateConversationTitle,
} from "@/lib/conversation";
import { getLLMConfig, setLLMConfig as persistLLMConfig } from "@/lib/config";
import { generateId } from "@/utils/format";

export default function Home() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversation, setCurrentConversation] =
        useState<Conversation | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
    const [isAddHoldingModalOpen, setIsAddHoldingModalOpen] = useState(false);
    const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => getLLMConfig());
    const [theme, setTheme] = useState<Theme>("dark");
    const abortControllerRef = useRef<AbortController | null>(null);

    // AI 生成摘要并更新标题
    const generateAISummary = async (convId: string, text: string) => {
        try {
            const resp = await fetch("/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: text }),
            });
            const data = await resp.json();
            if (data.title) {
                // 使用 force=true 确保标题不被截断
                updateConversationTitle(convId, data.title, true);
                setConversations(getConversations());
            }
        } catch (err) {
            console.error("Summarization failed:", err);
        }
    };

    // 自动扫描并总结所有“通用”或“截断”标题的会话
    const summarizeAllGenericTitles = async (convs: Conversation[]) => {
        // 只筛选出标题为“新对话”或者看起来是原始提问（超过20个字符且可能被截断）的会话
        const needsSummary = convs.filter(c => 
            c.messages.length > 0 && 
            (c.title === "新对话" || c.title.endsWith("...") || c.title.length > 25)
        );

        for (const conv of needsSummary) {
            const firstMsg = conv.messages[0];
            if (firstMsg && firstMsg.question) {
                // 逐个总结，避免瞬间并发过高
                await generateAISummary(conv.id, firstMsg.question);
            }
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const storedConvs = getConversations();
        setConversations(storedConvs);
        setCurrentConversation(getCurrentConversation());

        // 首次加载时异步触发“大扫除”总结
        if (storedConvs.length > 0) {
            summarizeAllGenericTitles(storedConvs);
        }

        // Fetch LLM settings from DB
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data && data.apiKey) {
                    setLlmConfig(data);
                }
            })
            .catch(err => console.error('Failed to fetch settings:', err));

        const savedTheme =
            (localStorage.getItem("finpal_theme") as Theme) || "dark";
        setTheme(savedTheme);
        document.documentElement.classList.toggle(
            "dark",
            savedTheme === "dark",
        );
    }, []);

    const handleSwitchConversation = (id: string) => {
        handleStop();
        const conv = conversations.find((c) => c.id === id) || null;
        setCurrentConversationId(id);
        setCurrentConversation(conv);

        // 补救逻辑：如果点击的是一个没有标题的旧会话，且有消息，尝试补全摘要
        if (conv && conv.title === "新对话" && conv.messages.length > 0) {
            const firstMsg = conv.messages[0];
            if (firstMsg && firstMsg.question) {
                generateAISummary(conv.id, firstMsg.question);
            }
        }
    };

    const handleDeleteConversation = (id: string) => {
        deleteConversation(id);
        setConversations(getConversations());

        if (currentConversation?.id === id) {
            const updated = getCurrentConversation();
            setCurrentConversation(updated);
        }
    };

    const handleNewConversation = () => {
        const newId = createNewConversation();
        const nextConversations = getConversations();
        setConversations(nextConversations);
        const newConversation = nextConversations.find((c) => c.id === newId);
        if (newConversation) {
            setCurrentConversation(newConversation);
        }
    };

    const ensureConversation = (): Conversation | null => {
        if (currentConversation) {
            return currentConversation;
        }

        const newId = createNewConversation();
        const nextConversations = getConversations();
        setConversations(nextConversations);
        const created = nextConversations.find((c) => c.id === newId) || null;
        setCurrentConversation(created);
        return created;
    };

    const handleSend = async (question: string) => {
        const activeConversation = ensureConversation();
        if (!activeConversation) {
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setIsLoading(true);

        // 立即添加用户消息到 UI（乐观更新）
        const userMessage: Message = {
            id: generateId(),
            question,
            optimisticAnswer: "",
            pessimisticAnswer: "",
            timestamp: Date.now(),
            status: "searching",
            searchResults: [],
            findingsCount: 0,
            totalQueries: 0,
            decisions: [],
            cioPlanning: false,
            agentTasks: {},
            isDirectAnswer: false,
        };
        addMessageToConversation(activeConversation.id, userMessage);
        setConversations(getConversations());
        setCurrentConversation(getCurrentConversation());

        // Helper function to update message with search progress
        // OPTIMIZATION: Use ref-based or batch updates to avoid layout shift and slow localStorage reads
        const updateMessageProgress = (updates: Partial<Message>) => {
            // Update the local object reference for immediate access in the next SSE callback
            Object.assign(userMessage, updates);
            
            // Persist state
            updateMessageInConversation(
                activeConversation.id,
                userMessage.id,
                { ...updates, timestamp: Date.now() },
            );
            
            setCurrentConversation(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    messages: prev.messages.map(m => m.id === userMessage.id ? { ...m, ...updates } : m)
                };
            });
        };

        const EVENT_HISTORY_LIMIT = 80;
        const truncateForEvent = (text?: string, length = 80) =>
            text ? (text.length > length ? text.slice(0, length) + "…" : text) : undefined;

        const appendEventLog = (entry: Omit<EventLogEntry, "id" | "timestamp">) => {
            const history = [...(userMessage.eventHistory || [])];
            history.push({
                id: generateId(),
                timestamp: Date.now(),
                ...entry,
            });
            if (history.length > EVENT_HISTORY_LIMIT) {
                history.shift();
            }
            updateMessageProgress({ eventHistory: history });
        };

        // 用于累积流式内容的变量
        let currentRound = 1;
        let optimisticStreamContent = "";
        let pessimisticStreamContent = "";
        let optimisticRebuttalStreamContent = "";
        let pessimisticRebuttalStreamContent = "";
        let deciderStreamContent = "";
        let deciderCardCreated = false;
        let roundJudgeCardCreated = false;
        
        const updateDebateHistory = (roundNum: number, role: 'optimistic' | 'pessimistic', chunk: string, isThinking = false) => {
            const history = [...(userMessage.debateHistory || [])];
            let round = history.find(r => r.round === roundNum);
            
            if (!round) {
                round = { round: roundNum };
                history.push(round);
            }
            
            if (role === 'optimistic') {
                if (isThinking) round.optimisticThinking = (round.optimisticThinking || "") + chunk;
                else {
                    round.optimisticAnswer = (round.optimisticAnswer || "") + chunk;
                    if (roundNum === 1) optimisticStreamContent += chunk;
                    else optimisticRebuttalStreamContent += chunk;
                }
            } else {
                if (isThinking) round.pessimisticThinking = (round.pessimisticThinking || "") + chunk;
                else {
                    round.pessimisticAnswer = (round.pessimisticAnswer || "") + chunk;
                    if (roundNum === 1) pessimisticStreamContent += chunk;
                    else pessimisticRebuttalStreamContent += chunk;
                }
            }
            
            console.log('[page] updateDebateHistory', { roundNum, role, chunk: chunk.substring(0, 20), isThinking });
            updateMessageProgress({ 
                debateHistory: history,
                // 为了向后兼容某些组件，同时更新顶层字段
                optimisticAnswer: roundNum === 1 && role === 'optimistic' ? round.optimisticAnswer : userMessage.optimisticAnswer,
                pessimisticAnswer: roundNum === 1 && role === 'pessimistic' ? round.pessimisticAnswer : userMessage.pessimisticAnswer,
                optimisticRebuttal: roundNum > 1 && role === 'optimistic' ? round.optimisticAnswer : userMessage.optimisticRebuttal,
                pessimisticRebuttal: roundNum > 1 && role === 'pessimistic' ? round.pessimisticAnswer : userMessage.pessimisticRebuttal,
            });
        };

        const updateDebateHistoryFull = (roundNum: number, role: 'optimistic' | 'pessimistic', content: string, thinking?: string) => {
            const history = [...(userMessage.debateHistory || [])];
            console.log('[page] updateDebateHistoryFull - before', { roundNum, role, historyLen: history.length });
            let round = history.find(r => r.round === roundNum);
            if (!round) {
                round = { round: roundNum };
                history.push(round);
            }
            if (role === 'optimistic') {
                round.optimisticAnswer = content;
                if (thinking) round.optimisticThinking = thinking;
            } else {
                round.pessimisticAnswer = content;
                if (thinking) round.pessimisticThinking = thinking;
            }
            console.log('[page] updateDebateHistoryFull - after', { historyLen: history.length, round });
            updateMessageProgress({ debateHistory: history });
        };

        const getAgentName = (id: string) => {
            if (id.startsWith("db-")) return "🏦 持仓专员";
            if (id.startsWith("web-")) return "🌐 侦察专员";
            if (id.startsWith("quant-")) return "📐 量化专员";
            return "🤖 助理专员";
        };

        try {
            // Try streaming first
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "text/event-stream",
                },
                body: JSON.stringify({
                    question,
                    config: llmConfig,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.details ||
                        errorData.error ||
                        "Failed to get response",
                );
            }

            // Check if we got a stream or regular JSON
            const contentType = response.headers.get("content-type");

            if (contentType?.includes("text/event-stream")) {
                // Handle SSE stream
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let finalVerdictSnapshot: any = null;
                let buffer = ""; // Buffer for incomplete SSE messages
                let currentSearchResults: any[] = [];
                let currentDbResults: any[] = [];

                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        // Use stream mode to handle multi-byte characters across chunks
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split("\n");

                        // Keep the last line in buffer if it's incomplete (no newline at end)
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                try {
                                    const event = JSON.parse(line.slice(6));

                                    switch (event.type) {
                                        case "cio_planning":
                                            updateMessageProgress({
                                                status: "searching",
                                                cioPlanning: true,
                                            });
                                            appendEventLog({
                                                label: "CIO 规划",
                                                detail: truncateForEvent(event.data?.message),
                                                status: "running",
                                                source: "CIO",
                                            });
                                            break;
                                        case "agent_start":
                                            if (event.data.agentId) {
                                                const tasks = { ...(userMessage.agentTasks || {}) };
                                                tasks[event.data.agentId] = {
                                                    id: event.data.agentId,
                                                    name: getAgentName(event.data.agentId),
                                                    description: event.data.taskDescription || "任务已启动",
                                                    status: "running",
                                                };
                                                updateMessageProgress({
                                                    status: "searching",
                                                    agentTasks: tasks,
                                                    cioPlanning: false,
                                                });
                                                appendEventLog({
                                                    label: `${getAgentName(event.data.agentId)} 启动`,
                                                    detail: truncateForEvent(event.data.taskDescription),
                                                    status: "running",
                                                    source: event.data.agentId,
                                                });
                                            }
                                            break;
                                        case "agent_progress":
                                            if (event.data.agentId) {
                                                const tasks = { ...(userMessage.agentTasks || {}) };
                                                if (tasks[event.data.agentId]) {
                                                    tasks[event.data.agentId].progressMessage = event.data.message;
                                                    // Add to the sub-step timeline array
                                                    tasks[event.data.agentId].progressLogs = [
                                                        ...(tasks[event.data.agentId].progressLogs || []),
                                                        event.data.message
                                                    ];
                                                    
                                                    const updates: Partial<Message> = { agentTasks: tasks };
                                                    
                                                    // Also capture any research findings sent during progress
                                                    if (event.data.finding) {
                                                        console.log('[page] SSE: found finding in agent_progress', event.data.finding);
                                                        updates.allFindings = [
                                                            ...(userMessage.allFindings || []),
                                                            event.data.finding
                                                        ];
                                                    }
                                                    
                                                    updateMessageProgress(updates);
                                                    // deep-agent 的内部时间线已经通过 timeline_event 展示，避免首屏重复刷屏
                                                    if (event.data.message && event.data.agentId !== "deep-agent") {
                                                        appendEventLog({
                                                            label: `${getAgentName(event.data.agentId)} 进度`,
                                                            detail: truncateForEvent(event.data.message),
                                                            status: "running",
                                                            source: event.data.agentId,
                                                        });
                                                    }
                                                }
                                            }
                                            break;
                                        case "agent_done":
                                            if (event.data.agentId) {
                                                const tasks = { ...(userMessage.agentTasks || {}) };
                                                if (tasks[event.data.agentId]) {
                                                    const findings = event.data.findings || [];
                                                    console.log(`[page] SSE: agent_done for ${event.data.agentId}`, { 
                                                        hasResults: !!event.data.results,
                                                        findingsCount: findings.length,
                                                        data: event.data
                                                    });
                                                    
                                                    tasks[event.data.agentId].status = "done";
                                                    tasks[event.data.agentId].resultSummary = event.data.summary;
                                                    tasks[event.data.agentId].rawResult = event.data.results?.[0];
                                                    
                                                    const updates: Partial<Message> = { agentTasks: tasks };
                                                    if (findings.length > 0) {
                                                        updates.allFindings = [
                                                            ...(userMessage.allFindings || []),
                                                            ...findings
                                                        ];
                                                    }
                                                    updateMessageProgress(updates);
                                                    appendEventLog({
                                                        label: `${getAgentName(event.data.agentId)} 完成`,
                                                        detail: truncateForEvent(event.data.summary),
                                                        status: "success",
                                                        source: event.data.agentId,
                                                    });
                                                }
                                            }
                                            break;
                                        case "agent_error":
                                            if (event.data.agentId) {
                                                const tasks = { ...(userMessage.agentTasks || {}) };
                                                if (tasks[event.data.agentId]) {
                                                    tasks[event.data.agentId].status = "error";
                                                    tasks[event.data.agentId].error = event.data.error;
                                                    updateMessageProgress({ agentTasks: tasks });
                                                }
                                            }
                                            break;
                                        case "direct_answer":
                                            // 直接回答（如能力边界询问）
                                            console.log('[page] SSE: direct_answer', event.data);
                                            if (event.data.answer) {
                                                updateMessageProgress({
                                                    status: "complete",
                                                    optimisticAnswer: event.data.answer,
                                                    debateSummary: event.data.answer,
                                                    debateWinner: "draw",
                                                    isDirectAnswer: true,
                                                });
                                            }
                                            break;
                                        case "gate_keeper_check":
                                            updateMessageProgress({
                                                status: "analyzing",
                                                currentQuery: `Gate Keeper 检查中: ${event.data.message}`,
                                            });
                                            break;
                                        case "final_verdict":
                                            finalVerdictSnapshot = event.data;
                                            // 仅更新最终裁决，避免覆盖流式辩论内容与轮次
                                            updateMessageProgress({
                                                finalVerdict: event.data,
                                                cioPlanning: false,
                                                status: userMessage.status === "complete" ? "complete" : "analyzing",
                                            });
                                            appendEventLog({
                                                label: "最终建议准备",
                                                detail: truncateForEvent(event.data.summary),
                                                status: "success",
                                                source: "final-verdict",
                                            });
                                            break;
                                        case "planning":
                                            updateMessageProgress({
                                                status: "searching",
                                            });
                                            break;
                                        case "searching":
                                            updateMessageProgress({
                                                status: "searching",
                                                currentQuery:
                                                    event.data?.currentQuery || event.message || "搜索中...",
                                                findingsCount:
                                                    (userMessage.findingsCount ||
                                                        0) + 1,
                                            });
                                            break;
                                        case "db_query":
                                            updateMessageProgress({
                                                status: "searching",
                                                currentQuery:
                                                    event.message ||
                                                    "正在查询数据库...",
                                            });
                                            appendEventLog({
                                                label: "数据库查询",
                                                detail: truncateForEvent(event.message),
                                                status: "running",
                                                source: "db-agent",
                                            });
                                            break;
                                        case "db_result":
                                            // db_result 是进度通知，实际结果从 skill 输出获取
                                            updateMessageProgress({
                                                status: "analyzing",
                                            });
                                            appendEventLog({
                                                label: "数据库返回",
                                                detail: truncateForEvent(event.message || "查询完成"),
                                                status: "success",
                                                source: "db-agent",
                                            });
                                            break;
                                        case "search_result":
                                            // search_result 可能没有 data 字段，从 message 提取查询
                                            const searchQuery = event.data?.query || event.message?.replace('搜索: ', '') || '未知查询';
                                            const searchResults = event.data?.results || [];
                                            currentSearchResults = [
                                                ...currentSearchResults,
                                                {
                                                    query: searchQuery,
                                                    results: searchResults,
                                                },
                                            ];
                                            updateMessageProgress({
                                                searchResults: currentSearchResults,
                                            });
                                            appendEventLog({
                                                label: "网页搜索完成",
                                                detail: `${truncateForEvent(searchQuery)} · ${searchResults.length} 条`,
                                                status: "success",
                                                source: "web-search",
                                            });
                                            break;
                                        case "search_complete":
                                            // 搜索完成，进入分析阶段
                                            updateMessageProgress({
                                                status: "analyzing",
                                                currentQuery:
                                                    "搜索完成，正在生成关键事实...",
                                            });
                                            break;
                                         case "all_findings":
                                             console.log('[page] SSE: all_findings', event.data);
                                             updateMessageProgress({
                                                 status: "analyzing",
                                                 allFindings: event.data.allFindings,
                                             });
                                             break;
                                         case "timeline_event":
                                             // Claude Code 风格的详细时间线事件
                                             console.log('[page] SSE: timeline_event', event.data);
                                             if (event.data) {
                                                 const isLowSignalBootstrapEvent =
                                                     (event.data.label === '状态评估' &&
                                                         event.data.metadata?.confidence === 0 &&
                                                         event.data.metadata?.gapCount === 0) ||
                                                     (event.data.label === '分析目标') ||
                                                     (event.data.label === '轮次裁决' &&
                                                         typeof event.data.detail === 'string' &&
                                                         event.data.detail.includes('评估第 1 轮'));

                                                 if (isLowSignalBootstrapEvent) {
                                                     break;
                                                 }

                                                 appendEventLog({
                                                     type: event.data.eventType || 'thinking',
                                                     label: event.data.label || '执行中...',
                                                     detail: event.data.detail,
                                                     status: event.data.eventType === 'complete' ? 'success' : 'running',
                                                     source: event.data.source || 'deep-agent',
                                                     expandable: event.data.expandable,
                                                     expandedContent: event.data.content,
                                                     metadata: event.data.metadata,
                                                 });
                                             }
                                             break;
                                         case "analyzing":
                                            updateMessageProgress({
                                                status: "analyzing",
                                                currentQuery:
                                                    event.data.message ||
                                                    "正在分析搜索结果...",
                                            });
                                            break;
                                        case "research_summary_stream":
                                            // 流式关键事实更新
                                            console.log(
                                                "[Page] Received research_summary_stream",
                                                event.data,
                                            );
                                            if (
                                                event.data.keyFacts &&
                                                Array.isArray(
                                                    event.data.keyFacts,
                                                )
                                            ) {
                                                console.log(
                                                    "[Page] Updating message progress with keyFacts:",
                                                    event.data.keyFacts,
                                                );
                                                updateMessageProgress({
                                                    status: "analyzing",
                                                    researchSummary: {
                                                        key_facts:
                                                            event.data.keyFacts,
                                                        data_points:
                                                            event.data
                                                                .dataPoints ||
                                                            [],
                                                        summary:
                                                            event.data
                                                                .summary ||
                                                            "生成中...",
                                                    },
                                                });
                                            } else {
                                                console.log(
                                                    "[Page] No keyFacts in event data",
                                                );
                                            }
                                            break;
                                        case "research_summary":
                                            updateMessageProgress({
                                                status: "analyzing",
                                                researchSummary: {
                                                    key_facts:
                                                        event.data.keyFacts,
                                                    data_points:
                                                        event.data.dataPoints,
                                                    summary: event.data.summary,
                                                },
                                            });
                                            break;
                                        case "node_start":
                                            if (event.data?.node === "round_judge") {
                                                currentRound = event.data.round || currentRound;
                                            }
                                            // 处理裁决完成事件
                                            if (
                                                event.data.node ===
                                                    "decider_complete" &&
                                                event.data.winner
                                            ) {
                                                const currentDecisions =
                                                    userMessage.decisions || [];
                                                const newDecision = {
                                                    round:
                                                        event.data.round ||
                                                        currentDecisions.filter(d => !d.pending).length + 1,
                                                    winner: event.data.winner,
                                                    shouldContinue:
                                                        event.data
                                                            .shouldContinue ??
                                                        false,
                                                    reason:
                                                        event.data.reason || "",
                                                    isFinal:
                                                        !event.data
                                                            .shouldContinue,
                                                    pending: false,
                                                };
                                                // Replace the last pending card, or append if none
                                                const pendingIdx = currentDecisions.map((d, i) => d.pending ? i : -1).filter(i => i >= 0).pop();
                                                const updatedDecisions = pendingIdx !== undefined
                                                    ? currentDecisions.map((d, i) => i === pendingIdx ? newDecision : d)
                                                    : [...currentDecisions, newDecision];
                                                updateMessageProgress({
                                                    status: "analyzing",
                                                    currentQuery:
                                                        event.data.message,
                                                    decisions: updatedDecisions,
                                                });
                                            } else {
                                                updateMessageProgress({
                                                    status: "analyzing",
                                                    currentQuery:
                                                        event.data.message,
                                                });
                                            }
                                            break;
                                        case "optimistic_output":
                                            console.log('[page] SSE: optimistic_output', event.data);
                                            updateDebateHistoryFull(1, 'optimistic', event.data.answer, event.data.thinking);
                                            updateMessageProgress({
                                                status: "analyzing",
                                                optimisticAnswer:
                                                    event.data.answer,
                                                optimisticThinking:
                                                    event.data.thinking,
                                            });
                                            appendEventLog({
                                                label: "乐观派观点生成",
                                                detail: truncateForEvent(event.data.answer),
                                                status: "running",
                                                source: "debate",
                                            });
                                            break;
                                        case "pessimistic_output":
                                            console.log('[page] SSE: pessimistic_output', event.data);
                                            updateDebateHistoryFull(1, 'pessimistic', event.data.answer, event.data.thinking);
                                            updateMessageProgress({
                                                status: "analyzing",
                                                pessimisticAnswer:
                                                    event.data.answer,
                                                pessimisticThinking:
                                                    event.data.thinking,
                                            });
                                            appendEventLog({
                                                label: "悲观派观点生成",
                                                detail: truncateForEvent(event.data.answer),
                                                status: "running",
                                                source: "debate",
                                            });
                                            break;
                                        case "optimistic_rebuttal":
                                            console.log('[page] SSE: optimistic_rebuttal', event.data);
                                            updateDebateHistoryFull(currentRound, 'optimistic', event.data.rebuttal);
                                            updateMessageProgress({
                                                status: "analyzing",
                                                optimisticRebuttal:
                                                    event.data.rebuttal,
                                            });
                                            break;
                                        case "pessimistic_rebuttal":
                                            console.log('[page] SSE: pessimistic_rebuttal', event.data);
                                            updateDebateHistoryFull(currentRound, 'pessimistic', event.data.rebuttal);
                                            updateMessageProgress({
                                                status: "analyzing",
                                                pessimisticRebuttal:
                                                    event.data.rebuttal,
                                            });
                                            break;
                                        case "round_judge":
                                            console.log('[page] SSE: round_judge', event.data);
                                            // round_judge fires with final result \u2014 replace pending card or append
                                            if (event.data.round !== undefined) {
                                                const currentDecisions = userMessage.decisions || [];
                                                const judgeDecision = {
                                                    round: event.data.round as number,
                                                    winner: (event.data.winner || 'draw') as 'optimistic' | 'pessimistic' | 'draw',
                                                    shouldContinue: Boolean(event.data.shouldContinue),
                                                    reason: String(event.data.reason || ''),
                                                    isFinal: !event.data.shouldContinue,
                                                    pending: false,
                                                };
                                                const pendingIdx = currentDecisions.map((d, i) => d.pending ? i : -1).filter(i => i >= 0).pop();
                                                const updatedDecisions = pendingIdx !== undefined
                                                    ? currentDecisions.map((d, i) => i === pendingIdx ? judgeDecision : d)
                                                    : [...currentDecisions, judgeDecision];
                                                // Update currentRound for next rebuttal
                                                if (event.data.shouldContinue && event.data.round) {
                                                    currentRound = (event.data.round as number) + 1;
                                                    console.log('[page] Incremented currentRound to', currentRound);
                                                }

                                                updateMessageProgress({
                                                    status: "analyzing",
                                                    decisions: updatedDecisions,
                                                });
                                            }
                                            break;
                                        case "stream_chunk":
                                            if (event.data?.chunk) {
                                                const chunk = event.data.chunk;
                                                switch (event.data.node) {
                                                    case "optimistic_initial":
                                                        updateDebateHistory(1, 'optimistic', chunk);
                                                        break;
                                                    case "pessimistic_initial":
                                                        updateDebateHistory(1, 'pessimistic', chunk);
                                                        break;
                                                    case "optimistic_rebuttal":
                                                        updateDebateHistory(currentRound, 'optimistic', chunk);
                                                        break;
                                                    case "pessimistic_rebuttal":
                                                        updateDebateHistory(currentRound, 'pessimistic', chunk);
                                                        break;
                                                    case "round_judge":
                                                        // On first round_judge chunk: immediately show a pending judge card
                                                        if (!roundJudgeCardCreated) {
                                                            roundJudgeCardCreated = true;
                                                            const existingDecisions = userMessage.decisions || [];
                                                            const pendingJudge = {
                                                                round: existingDecisions.filter(d => !d.pending).length + 1,
                                                                winner: 'draw' as const,
                                                                shouldContinue: true,
                                                                reason: '裁决中...',
                                                                isFinal: false,
                                                                pending: true,
                                                            };
                                                            updateMessageProgress({
                                                                status: "analyzing",
                                                                decisions: [...existingDecisions, pendingJudge],
                                                            });
                                                        }
                                                        break;
                                                    case "decider":
                                                        // On the very first decider chunk, push a pending decision card immediately
                                                        if (!deciderCardCreated) {
                                                            deciderCardCreated = true;
                                                            const existingDecisions = userMessage.decisions || [];
                                                            const pendingDecision = {
                                                                round: existingDecisions.length + 1,
                                                                winner: 'draw' as const,
                                                                shouldContinue: false,
                                                                reason: '裁决中...',
                                                                isFinal: false,
                                                                pending: true,
                                                            };
                                                            updateMessageProgress({
                                                                status: "analyzing",
                                                                decisions: [...existingDecisions, pendingDecision],
                                                            });
                                                        }
                                                        break;
                                                    case "reflector":
                                                        {
                                                            const depth = event.data.depth || 0;
                                                            const currentReflections = { ...(userMessage.reflections || {}) };
                                                            currentReflections[depth] = (currentReflections[depth] || "") + chunk;
                                                            updateMessageProgress({
                                                                status: "analyzing",
                                                                reflections: currentReflections
                                                            });
                                                        }
                                                        break;
                                                }
                                            }
                                            break;
                                        case "complete":
                                            console.log("[Page] SSE 'complete' event received:", event);
                                            if (event.data && event.data.summary) {
                                                updateMessageProgress({
                                                    status: "complete",
                                                    debateSummary: event.data.summary,
                                                    debateWinner: event.data.winner || "draw",
                                                    cioPlanning: false,
                                                });
                                            }
                                            appendEventLog({
                                                label: "分析结束",
                                                detail: truncateForEvent(event.data?.summary),
                                                status: "success",
                                                source: "complete",
                                            });
                                            break;
                                        case "error":
                                            console.error("[Page] SSE 'error' event received:", event);
                                            if (event.error || (event.data && event.data.error)) {
                                                const errorText = event.error || event.data.error;
                                                updateMessageProgress({
                                                    status: "error",
                                                    cioPlanning: false,
                                                });
                                                throw new Error(errorText);
                                            }
                                            break;
                                    }
                                } catch (e) {
                                    console.error(
                                        "Failed to parse SSE data:",
                                        e,
                                        "Line:",
                                        line,
                                    );
                                }
                            }
                        }
                    }

                    // Process any remaining data in buffer
                    if (buffer.startsWith("data: ")) {
                        try {
                            const event = JSON.parse(buffer.slice(6));
                            console.log("[Page] Parsing final buffer event:", event);
                            if (event.type === "complete") {
                                if (event.data?.summary) {
                                    updateMessageProgress({
                                        status: "complete",
                                        debateSummary: event.data.summary,
                                        debateWinner: event.data.winner || userMessage.debateWinner || "draw",
                                        cioPlanning: false,
                                    });
                                }
                            } else if (event.type === "error") {
                                throw new Error(event.data?.error || event.error);
                            }
                        } catch (e) {
                            console.error(
                                "Failed to parse final SSE buffer:",
                                e,
                            );
                        }
                    }
                }

                // SSE 收尾：只做状态收口，不再用 finalResult 二次覆盖流式内容
                updateMessageInConversation(
                    activeConversation.id,
                    userMessage.id,
                    {
                        status: "complete",
                        // 保留流式阶段已写入的内容；仅补充缺失字段
                        finalVerdict: finalVerdictSnapshot || userMessage.finalVerdict,
                        dbResults: currentDbResults.length > 0 ? currentDbResults : userMessage.dbResults,
                        cioPlanning: false,
                        isDirectAnswer: userMessage.isDirectAnswer,
                    } as any,
                );

                // 如果是第一条消息，更新对话标题（异步 AI 摘要）
                if (activeConversation.messages.length === 1) {
                    generateAISummary(activeConversation.id, question);
                }

                setConversations(getConversations());
                setCurrentConversation(getCurrentConversation());
            } else {
                // Fallback to regular JSON response
                const data = await response.json();

                // 更新现有消息
                updateMessageInConversation(
                    activeConversation.id,
                    userMessage.id,
                    {
                        status: "complete",
                        optimisticAnswer: data.optimisticAnswer,
                        pessimisticAnswer: data.pessimisticAnswer,
                        optimisticRebuttal: data.optimisticRebuttal,
                        pessimisticRebuttal: data.pessimisticRebuttal,
                        debateWinner: data.debateWinner,
                        debateSummary: data.debateSummary,
                        searchResults: data.searchResults,
                        dbResults: data.dbResults,
                        allFindings: (data as any).allFindings,
                        researchSummary: data.researchSummary,
                        engineUsage: data.engineUsage,
                        round: data.round,
                        isDirectAnswer: userMessage.isDirectAnswer,
                    } as any,
                );

                if (activeConversation.messages.length === 1) {
                    if (activeConversation.messages.length === 1) {
                        generateAISummary(activeConversation.id, question);
                    }
                }

                setConversations(getConversations());
                setCurrentConversation(getCurrentConversation());
            }
        } catch (error) {
            console.error("Error:", error);
            const errorMsg =
                error instanceof Error ? error.message : "获取回答失败，请重试";

            // Update the user message with error instead of showing alert
            updateMessageInConversation(activeConversation.id, userMessage.id, {
                status: "error",
                optimisticAnswer: "",
                pessimisticAnswer: "",
                optimisticRebuttal: "",
                pessimisticRebuttal: "",
                debateWinner: "error",
                debateSummary: `请求失败: ${errorMsg}`,
                searchResults: [],
                dbResults: [],
                allFindings: [],
                researchSummary: null,
                engineUsage: null,
                round: 0,
            } as any);

            setConversations(getConversations());
            setCurrentConversation(getCurrentConversation());
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSettings = async (config: LLMConfig) => {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            
            if (!response.ok) throw new Error('Failed to save settings');
            
            const savedConfig = await response.json();
            setLlmConfig(savedConfig);
            persistLLMConfig(savedConfig); // Keep localStorage as fallback
            setIsSettingsOpen(false);
        } catch (error) {
            console.error('Save settings error:', error);
            alert('保存设置失败，请重试');
        }
    };

    const handleToggleTheme = () => {
        const newTheme: Theme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
        document.documentElement.classList.toggle("dark", newTheme === "dark");
        localStorage.setItem("finpal_theme", newTheme);
    };

    const handleAddHolding = async (holding: HoldingData) => {
        try {
            const response = await fetch('/api/holdings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fundCode: holding.fundCode,
                    fundName: holding.fundName,  // 传递识别出的基金名称
                    shares: holding.shares,
                    price: holding.costPrice,
                    date: holding.buyDate,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `添加持仓失败: ${response.status}`);
            }

            console.log('持仓添加成功:', holding);
        } catch (error) {
            console.error('添加持仓失败:', error);
            throw error;
        }
    };

    const messages = currentConversation?.messages || [];
    const activeTitle = currentConversation?.title || "新对话";

    return (
        <div className="h-dvh bg-slate-100 dark:bg-slate-950">
            <div className="h-full grid grid-cols-[288px_1fr]">
                <Sidebar
                    conversations={conversations}
                    currentConversationId={currentConversation?.id || null}
                    onSwitchConversation={handleSwitchConversation}
                    onDeleteConversation={handleDeleteConversation}
                    onNewConversation={handleNewConversation}
                    onAddHolding={() => setIsAddHoldingModalOpen(true)}
                    onTogglePersona={() => setIsPersonaModalOpen(true)}
                />

                <main className="min-w-0 h-full flex flex-col bg-slate-50 dark:bg-slate-950">
                    <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                        <div className="min-w-0">
                            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {activeTitle}
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                双人格并行回答
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <ThemeToggle
                                theme={theme}
                                onToggle={handleToggleTheme}
                            />
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                                title="设置"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                            </button>
                        </div>
                    </header>

                    <MessageList messages={messages} isLoading={isLoading} />
                    <ChatInput onSend={handleSend} disabled={isLoading} />
                </main>
            </div>

            <SettingsModal
                isOpen={isSettingsOpen}
                config={llmConfig}
                onSave={handleSaveSettings}
                onClose={() => setIsSettingsOpen(false)}
            />

             <PersonaModal
                isOpen={isPersonaModalOpen}
                onClose={() => setIsPersonaModalOpen(false)}
            />

            <AddHoldingModal
                isOpen={isAddHoldingModalOpen}
                onClose={() => setIsAddHoldingModalOpen(false)}
                onAddHolding={handleAddHolding}
                config={llmConfig}
            />
        </div>
    );
}
