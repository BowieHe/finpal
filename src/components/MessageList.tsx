'use client';

import { MessageCard } from './MessageCard';
import ResearchResults from './ResearchResults';
import DeciderResult from './DeciderResult';
import { TimelineDebate, TimelineMessage } from './TimelineDebate';
import { RoundDecision } from './RoundDecisionCard';

interface MessageListProps {
  messages: Array<{
    id: string;
    question: string;
    optimisticAnswer: string;
    pessimisticAnswer: string;
    optimisticThinking?: string;
    pessimisticThinking?: string;
    optimisticRebuttal?: string;
    pessimisticRebuttal?: string;
    debateWinner?: string;
    debateSummary?: string;
    searchResults?: any[];
    allFindings?: any[];
    researchSummary?: any;
    engineUsage?: Record<string, number>;
    round?: number;
    timestamp: number;
    // Real-time search status
    status?: 'searching' | 'analyzing' | 'complete' | 'error';
    currentQuery?: string;
    findingsCount?: number;
    totalQueries?: number;
    // Decider decisions per round
    decisions?: RoundDecision[];
  }>;
  isLoading?: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-[#282726] mx-auto mb-5 flex items-center justify-center">
            <span className="text-5xl">💭</span>
          </div>
          <p className="text-lg font-semibold text-[#CECDC3] mb-2">
            说说你正在纠结什么
          </p>
          <p className="text-sm text-[#6F6E69]">
            我会用"乐观派"和"悲观派"两种视角同时回答，帮你看清机会与风险。
          </p>
        </div>
      </div>
    );
  }

  const getStatusText = (status?: string, currentQuery?: string, optimisticAnswer?: string, pessimisticAnswer?: string) => {
    // 如果有乐观或悲观回答，说明正在辩论阶段
    const isDebating = optimisticAnswer || pessimisticAnswer;
    
    switch (status) {
      case 'searching':
        return currentQuery ? `正在搜索: ${currentQuery}` : '正在搜索信息...';
      case 'analyzing':
        if (isDebating) {
          return currentQuery || '正在进行辩论分析...';
        }
        return currentQuery || '正在分析搜索结果...';
      case 'complete':
        return '分析完成';
      case 'error':
        return '搜索出错';
      default:
        return '正在处理...';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {messages.map((message) => {
          // Build debate messages array (exclude user message - it will be shown separately)
          const debateMessages: TimelineMessage[] = [];
          
          // Add optimistic answer (if exists)
          if (message.optimisticAnswer) {
            debateMessages.push({
              role: 'optimistic',
              content: message.optimisticAnswer,
              thinking: message.optimisticThinking,
              timestamp: message.timestamp,
            });
          }
          
          // Add pessimistic answer (if exists)
          if (message.pessimisticAnswer) {
            debateMessages.push({
              role: 'pessimistic',
              content: message.pessimisticAnswer,
              thinking: message.pessimisticThinking,
              timestamp: message.timestamp,
            });
          }
          
          // Add rebuttals (if exists)
          if (message.optimisticRebuttal) {
            debateMessages.push({
              role: 'optimistic',
              content: message.optimisticRebuttal,
              timestamp: message.timestamp,
            });
          }
          
          if (message.pessimisticRebuttal) {
            debateMessages.push({
              role: 'pessimistic',
              content: message.pessimisticRebuttal,
              timestamp: message.timestamp,
            });
          }

          // Check if we should show real-time search results
          const showRealtimeSearch = message.status === 'searching';
          const isAnalyzing = message.status === 'analyzing';
          const hasSearchResults = message.searchResults && message.searchResults.length > 0;
          const hasResearchSummary = message.researchSummary && (
            message.researchSummary.key_facts?.length > 0 || 
            message.researchSummary.summary
          );
          const shouldShowResearch = hasSearchResults || hasResearchSummary || (message.status === 'searching' && message.currentQuery);
          const totalQueries = message.totalQueries || 0;
          const searchResults = message.searchResults || [];

          return (
            <div key={message.id} className="mb-8">
              {/* User Message */}
              <MessageCard
                role="user"
                content={message.question}
                timestamp={message.timestamp}
              />
              
              {/* Real-time Search Progress */}
              {showRealtimeSearch && (
                <div className="my-4 p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                        <span className="text-lg">🔬</span>
                      </div>
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        Deep Research
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {getStatusText(message.status, message.currentQuery, message.optimisticAnswer, message.pessimisticAnswer)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress bar - only show when totalQueries > 0 */}
                  {totalQueries > 0 && (
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-2">
                      <div 
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.min(90, ((message.findingsCount || 0) / totalQueries) * 100)}%` 
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {totalQueries > 0 && (
                      <span>
                        查询: {message.findingsCount || 0}/{totalQueries}
                      </span>
                    )}
                    {hasSearchResults && (
                      <span>
                        已搜索: {searchResults.length} 个查询
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Analyzing State - No spinner */}
              {isAnalyzing && (
                <div className="my-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                      <span className="text-lg">🧠</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        分析中
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {getStatusText(message.status, message.currentQuery, message.optimisticAnswer, message.pessimisticAnswer)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Research Results - 搜索过程中和完成后都使用这个组件 */}
              {shouldShowResearch && (
                <div className="my-4">
                  <ResearchResults
                    searchResults={searchResults}
                    allFindings={message.allFindings}
                    researchSummary={message.researchSummary}
                    engineUsage={message.engineUsage || {}}
                    isDeepResearch={message.allFindings && message.allFindings.length > 0}
                    isSearching={message.status === 'searching'}
                    pendingQueries={message.status === 'searching' && message.currentQuery ? [message.currentQuery] : []}
                  />
                </div>
              )}

              {/* Timeline Debate - 多空辩论 */}
              {debateMessages.length > 0 && (
                <TimelineDebate messages={debateMessages} decisions={message.decisions} />
              )}

              {/* Final Decision */}
              {message.debateWinner && (
                <div className="mt-6">
                  <DeciderResult 
                    winner={message.debateWinner}
                    summary={message.debateSummary || ''}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
