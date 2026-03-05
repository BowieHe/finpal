'use client';

import DebateBubble from './DebateBubble';
import ResearchResults from './ResearchResults';
import DeciderResult from './DeciderResult';
import { TimelineDebate } from './TimelineDebate';

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

  const getStatusText = (status?: string, currentQuery?: string) => {
    switch (status) {
      case 'searching':
        return currentQuery ? `正在搜索: ${currentQuery}` : '正在搜索信息...';
      case 'analyzing':
        return '正在分析搜索结果...';
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
          // Build timeline messages array only for non-empty content
          const timelineMessages = [];
          
          if (message.optimisticAnswer) {
            timelineMessages.push({
              type: 'optimistic-initial' as const,
              content: message.optimisticAnswer,
              thinking: message.optimisticThinking,
              timestamp: message.timestamp,
            });
          }
          
          if (message.pessimisticAnswer) {
            timelineMessages.push({
              type: 'pessimistic-initial' as const,
              content: message.pessimisticAnswer,
              thinking: message.pessimisticThinking,
              timestamp: message.timestamp,
            });
          }
          
          if (message.optimisticRebuttal) {
            timelineMessages.push({
              type: 'optimistic-rebuttal' as const,
              content: message.optimisticRebuttal,
              timestamp: message.timestamp,
            });
          }
          
          if (message.pessimisticRebuttal) {
            timelineMessages.push({
              type: 'pessimistic-rebuttal' as const,
              content: message.pessimisticRebuttal,
              timestamp: message.timestamp,
            });
          }

          // Check if we should show real-time search results
          const showRealtimeSearch = message.status === 'searching' || message.status === 'analyzing';
          const hasSearchResults = message.searchResults && message.searchResults.length > 0;
          const totalQueries = message.totalQueries || 0;
          const searchResults = message.searchResults || [];

          return (
            <div key={message.id} className="mb-8">
              {/* User Question */}
              <DebateBubble 
                type="user" 
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
                        {getStatusText(message.status, message.currentQuery)}
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
              
              {/* Research Results - 搜索过程中和完成后都使用这个组件 */}
              {hasSearchResults && (
                <div className="my-4">
                  <ResearchResults
                    searchResults={searchResults}
                    allFindings={message.allFindings}
                    researchSummary={message.researchSummary}
                    engineUsage={message.engineUsage || {}}
                    isDeepResearch={message.allFindings && message.allFindings.length > 0}
                    isSearching={message.status === 'searching' || message.status === 'analyzing'}
                  />
                </div>
              )}

              {/* Timeline Debate - 保留时间轴UI */}
              {timelineMessages.length > 0 && (
                <TimelineDebate messages={timelineMessages} />
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
