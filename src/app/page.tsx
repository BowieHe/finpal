'use client';

import { useState, useEffect } from 'react';
import ChatInput from '@/components/ChatInput';
import MessageList from '@/components/MessageList';
import Sidebar from '@/components/Sidebar';
import SettingsModal from '@/components/SettingsModal';
import ThemeToggle from '@/components/ThemeToggle';
import { Conversation, Message } from '@/types/conversation';
import { LLMConfig, Theme } from '@/types/config';
import {
  getConversations,
  getCurrentConversation,
  createNewConversation,
  setCurrentConversationId,
  deleteConversation,
  addMessageToConversation,
  updateMessageInConversation,
  updateConversationTitle,
} from '@/lib/conversation';
import { getLLMConfig, setLLMConfig as persistLLMConfig } from '@/lib/config';
import { generateId } from '@/utils/format';

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => getLLMConfig());
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setConversations(getConversations());
    setCurrentConversation(getCurrentConversation());

    const savedTheme = (localStorage.getItem('finpal_theme') as Theme) || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const handleSwitchConversation = (id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setCurrentConversation(conversation);
      setCurrentConversationId(id);
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
    const newConversation = nextConversations.find(c => c.id === newId);
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
    const created = nextConversations.find(c => c.id === newId) || null;
    setCurrentConversation(created);
    return created;
  };

  const handleSend = async (question: string, deepResearch: boolean = false) => {
    const activeConversation = ensureConversation();
    if (!activeConversation) {
      return;
    }

    setIsLoading(true);

    // 立即添加用户消息到 UI（乐观更新）
    const userMessage: Message = {
      id: generateId(),
      question,
      optimisticAnswer: '',
      pessimisticAnswer: '',
      timestamp: Date.now(),
      status: 'searching',
      searchResults: [],
      findingsCount: 0,
      totalQueries: 0,
    };
    addMessageToConversation(activeConversation.id, userMessage);
    setConversations(getConversations());
    setCurrentConversation(getCurrentConversation());

    // Helper function to update message with search progress
    const updateMessageProgress = (updates: Partial<Message>) => {
      updateMessageInConversation(activeConversation.id, userMessage.id, updates);
      setConversations(getConversations());
      setCurrentConversation(getCurrentConversation());
    };

    // 用于累积流式内容的变量
    let optimisticStreamContent = '';
    let pessimisticStreamContent = '';
    let optimisticRebuttalStreamContent = '';
    let pessimisticRebuttalStreamContent = '';

    try {
      // Try streaming first
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ question, config: llmConfig, deepResearch }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to get response');
      }

      // Check if we got a stream or regular JSON
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('text/event-stream')) {
        // Handle SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let finalResult: any = null;
        let buffer = ''; // Buffer for incomplete SSE messages
        let currentSearchResults: any[] = [];

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Use stream mode to handle multi-byte characters across chunks
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // Keep the last line in buffer if it's incomplete (no newline at end)
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6));

                  switch (event.type) {
                    case 'planning':
                      updateMessageProgress({
                        status: 'searching',
                      });
                      break;
                    case 'searching':
                      updateMessageProgress({
                        status: 'searching',
                        currentQuery: event.data.currentQuery,
                        findingsCount: (userMessage.findingsCount || 0) + 1,
                      });
                      break;
                    case 'search_result':
                      currentSearchResults = [...currentSearchResults, {
                        query: event.data.query,
                        results: event.data.results || [],
                      }];
                      updateMessageProgress({
                        searchResults: currentSearchResults,
                      });
                      break;
                    case 'analyzing':
                      updateMessageProgress({
                        status: 'analyzing',
                        currentQuery: event.data.message || '正在分析搜索结果...',
                      });
                      break;
                    case 'research_summary_stream':
                      // 流式关键事实更新
                      console.log('[Page] Received research_summary_stream', event.data);
                      if (event.data.keyFacts && Array.isArray(event.data.keyFacts)) {
                        console.log('[Page] Updating message progress with keyFacts:', event.data.keyFacts);
                        updateMessageProgress({
                          status: 'analyzing',
                          researchSummary: {
                            key_facts: event.data.keyFacts,
                            data_points: event.data.dataPoints || [],
                            summary: event.data.summary || '生成中...',
                          },
                        });
                      } else {
                        console.log('[Page] No keyFacts in event data');
                      }
                      break;
                    case 'research_summary':
                      updateMessageProgress({
                        status: 'analyzing',
                        researchSummary: {
                          key_facts: event.data.keyFacts,
                          data_points: event.data.dataPoints,
                          summary: event.data.summary,
                        },
                      });
                      break;
                    case 'node_start':
                      updateMessageProgress({
                        status: 'analyzing',
                        currentQuery: event.data.message,
                      });
                      break;
                    case 'optimistic_output':
                      updateMessageProgress({
                        status: 'analyzing',
                        optimisticAnswer: event.data.answer,
                        optimisticThinking: event.data.thinking,
                      });
                      break;
                    case 'pessimistic_output':
                      updateMessageProgress({
                        status: 'analyzing',
                        pessimisticAnswer: event.data.answer,
                        pessimisticThinking: event.data.thinking,
                      });
                      break;
                    case 'optimistic_rebuttal':
                      updateMessageProgress({
                        status: 'analyzing',
                        optimisticRebuttal: event.data.rebuttal,
                      });
                      break;
                    case 'pessimistic_rebuttal':
                      updateMessageProgress({
                        status: 'analyzing',
                        pessimisticRebuttal: event.data.rebuttal,
                      });
                      break;
                    case 'stream_chunk':
                      // 流式打字机效果 - 累积显示
                      if (event.data.node && event.data.chunk) {
                        const node = event.data.node as string;
                        const chunk = event.data.chunk as string;
                        // 根据节点类型更新对应的内容
                        switch (node) {
                          case 'optimistic':
                            optimisticStreamContent += chunk;
                            updateMessageProgress({
                              status: 'analyzing',
                              optimisticAnswer: optimisticStreamContent,
                            });
                            break;
                          case 'pessimistic':
                            pessimisticStreamContent += chunk;
                            updateMessageProgress({
                              status: 'analyzing',
                              pessimisticAnswer: pessimisticStreamContent,
                            });
                            break;
                          case 'optimistic_rebuttal':
                            optimisticRebuttalStreamContent += chunk;
                            updateMessageProgress({
                              status: 'analyzing',
                              optimisticRebuttal: optimisticRebuttalStreamContent,
                            });
                            break;
                          case 'pessimistic_rebuttal':
                            pessimisticRebuttalStreamContent += chunk;
                            updateMessageProgress({
                              status: 'analyzing',
                              pessimisticRebuttal: pessimisticRebuttalStreamContent,
                            });
                            break;
                        }
                      }
                      break;
                    case 'complete':
                      finalResult = event.result;
                      break;
                    case 'error':
                      throw new Error(event.data.error);
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e, 'Line:', line);
                }
              }
            }
          }

          // Process any remaining data in buffer
          if (buffer.startsWith('data: ')) {
            try {
              const event = JSON.parse(buffer.slice(6));
              if (event.type === 'complete') {
                finalResult = event.result;
              } else if (event.type === 'error') {
                throw new Error(event.data.error);
              }
            } catch (e) {
              console.error('Failed to parse final SSE buffer:', e);
            }
          }
        }

        if (finalResult) {
          // 更新现有消息而不是添加新消息
          // 注意：不覆盖 searchResults，保留之前实时更新的结果
          updateMessageInConversation(activeConversation.id, userMessage.id, {
            status: 'complete',
            optimisticAnswer: finalResult.optimisticAnswer,
            pessimisticAnswer: finalResult.pessimisticAnswer,
            optimisticRebuttal: finalResult.optimisticRebuttal,
            pessimisticRebuttal: finalResult.pessimisticRebuttal,
            debateWinner: finalResult.debateWinner,
            debateSummary: finalResult.debateSummary,
            // 不覆盖 searchResults，保留之前实时更新的结果
            allFindings: (finalResult as any).allFindings,
            researchSummary: finalResult.researchSummary,
            engineUsage: finalResult.engineUsage,
            round: finalResult.round,
          } as any);

          // 如果是第一条消息，更新对话标题
          if (activeConversation.messages.length === 1) {
            updateConversationTitle(activeConversation.id, question);
          }

          setConversations(getConversations());
          setCurrentConversation(getCurrentConversation());
        }
      } else {
        // Fallback to regular JSON response
        const data = await response.json();

        // 更新现有消息
        updateMessageInConversation(activeConversation.id, userMessage.id, {
          status: 'complete',
          optimisticAnswer: data.optimisticAnswer,
          pessimisticAnswer: data.pessimisticAnswer,
          optimisticRebuttal: data.optimisticRebuttal,
          pessimisticRebuttal: data.pessimisticRebuttal,
          debateWinner: data.debateWinner,
          debateSummary: data.debateSummary,
          searchResults: data.searchResults,
          allFindings: (data as any).allFindings,
          researchSummary: data.researchSummary,
          engineUsage: data.engineUsage,
          round: data.round,
        } as any);

        if (activeConversation.messages.length === 1) {
          updateConversationTitle(activeConversation.id, question);
        }

        setConversations(getConversations());
        setCurrentConversation(getCurrentConversation());
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = error instanceof Error ? error.message : '获取回答失败，请重试';

      // Update the user message with error instead of showing alert
      updateMessageInConversation(activeConversation.id, userMessage.id, {
        status: 'error',
        optimisticAnswer: '',
        pessimisticAnswer: '',
        optimisticRebuttal: '',
        pessimisticRebuttal: '',
        debateWinner: 'error',
        debateSummary: `请求失败: ${errorMsg}`,
        searchResults: [],
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

  const handleSaveSettings = (config: LLMConfig) => {
    setLlmConfig(config);
    persistLLMConfig(config);
    setIsSettingsOpen(false);
  };

  const handleToggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('finpal_theme', newTheme);
  };

  const messages = currentConversation?.messages || [];
  const activeTitle = currentConversation?.title || '新对话';

  return (
    <div className="h-[100dvh] bg-slate-100 dark:bg-slate-950">
      <div className="h-full grid grid-cols-[288px_1fr]">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversation?.id || null}
          onSwitchConversation={handleSwitchConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewConversation={handleNewConversation}
        />

        <main className="min-w-0 h-full flex flex-col bg-slate-50 dark:bg-slate-950">
          <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{activeTitle}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">双人格并行回答</p>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                title="设置"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756 3.35 0a1.724 1.724 0 002.573-1.066c1.543.94 3.31-.826 2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
    </div>
  );
}
