'use client';

import { MessageCard } from './MessageCard';
import ResearchResults from './ResearchResults';
import DeciderResult from './DeciderResult';
import DebateRoundStatsCard from './DebateRoundStatsCard';
import { TimelineDebate } from './TimelineDebate';
import { EventLogEntry, Message } from "@/types/conversation";

interface MessageListProps {
  messages: Message[];
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

  const getStatusText = (
    status?: string,
    currentQuery?: string,
    debateRounds?: Message['debateRounds']
  ) => {
    const isDebating = Boolean(debateRounds && debateRounds.length > 0);
    
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
          // Check if we should show real-time search results
          const isAnalyzing = message.status === 'analyzing';
          const hasSearchResults = message.searchResults && message.searchResults.length > 0;
          const hasResearchSummary = message.researchSummary && (
            message.researchSummary.key_facts?.length > 0 || 
            message.researchSummary.summary
          );
          const hasAgentTasks = message.agentTasks && Object.keys(message.agentTasks).length > 0;
          const hasReflections = message.reflections && Object.keys(message.reflections).length > 0;
          const hasAllFindings = message.allFindings && message.allFindings.length > 0;
          const hasEventHistory = message.eventHistory && message.eventHistory.length > 0;
          const hasDebateRounds = Boolean(message.debateRounds && message.debateRounds.length > 0);
          const shouldShowResearch = hasSearchResults || hasAllFindings || hasResearchSummary || hasReflections || hasEventHistory || (message.status === 'searching' && message.currentQuery) || message.cioPlanning || hasAgentTasks;
          const totalQueries = message.totalQueries || 0;
          const searchResults = message.searchResults || [];
          const shouldShowDebate =
            !message.isDirectAnswer && hasDebateRounds;

          return (
            <div key={message.id} className="mb-8">
              {/* User Message */}
              <MessageCard
                role="user"
                content={message.question}
                timestamp={message.timestamp}
              />
              
              {/* Analyzing State - No spinner */}
              {/* Analyzing State - Only shown when no search or debate content yet */}
              {isAnalyzing && !shouldShowResearch && !hasDebateRounds && (
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
                        {getStatusText(message.status, message.currentQuery, message.debateRounds)}
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
                    isSearching={message.status === 'searching'}
                    pendingQueries={message.status === 'searching' && message.currentQuery ? [message.currentQuery] : []}
                    agentTasks={message.agentTasks}
                    eventHistory={message.eventHistory}
                  />
                </div>
              )}

              {/* Timeline Debate - 多空辩论 */}
              {shouldShowDebate && (
                <>
                  <DebateRoundStatsCard
                    debateRounds={message.debateRounds}
                    status={message.status}
                  />
                  <TimelineDebate debateRounds={message.debateRounds} />
                </>
              )}

              {/* Final Decision */}
              {(message.debateWinner || message.finalVerdict) && (
                <div className="mt-6">
                  <DeciderResult 
                    winner={message.debateWinner || "draw"}
                    summary={
                      message.finalVerdict
                        ? JSON.stringify(message.finalVerdict)
                        : (message.debateSummary || '')
                    }
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
