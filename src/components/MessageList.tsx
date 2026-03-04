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
  }>;
  isLoading?: boolean;
  currentResearch?: {
    status: 'planning' | 'searching' | 'analyzing' | 'complete';
    currentQuery?: string;
    findingsCount?: number;
    totalQueries?: number;
    currentDepth?: number;
    maxDepth?: number;
  };
}

export default function MessageList({ messages, isLoading, currentResearch }: MessageListProps) {
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

          return (
            <div key={message.id} className="mb-8">
              {/* User Question */}
              <DebateBubble 
                type="user" 
                content={message.question} 
                timestamp={message.timestamp}
              />
              
              {/* Research Results */}
              {message.searchResults && message.searchResults.length > 0 && message.researchSummary && (
                <div className="my-4">
                  <ResearchResults
                    searchResults={message.searchResults}
                    allFindings={message.allFindings}
                    researchSummary={message.researchSummary}
                    engineUsage={message.engineUsage || {}}
                  />
                </div>
              )}
              
              {/* DeepResearch findings display */}
              {message.allFindings && message.allFindings.length > 0 && !(message.searchResults && message.searchResults.length > 0) && (
                <div className="my-4">
                  <ResearchResults
                    searchResults={[]}
                    allFindings={message.allFindings}
                    researchSummary={message.researchSummary}
                    engineUsage={message.engineUsage || {}}
                    isDeepResearch={true}
                  />
                </div>
              )}

              {/* Timeline Debate - only show when we have content */}
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
        
        {/* Default loading state */}
        {isLoading && !currentResearch && (
          <div className="flex justify-center py-6">
            <div className="inline-flex items-center gap-2 text-sm text-[#6F6E69]">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="font-medium">正在搜索信息并分析...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
