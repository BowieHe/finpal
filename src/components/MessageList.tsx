'use client';

import MessageBubble from './MessageBubble';
import PersonaCard from './PersonaCard';
import ResearchResults from './ResearchResults';
import DeciderResult from './DeciderResult';

interface MessageListProps {
  messages: Array<{
    id: string;
    question: string;
    optimisticAnswer: string;
    pessimisticAnswer: string;
    optimisticRebuttal?: string;
    pessimisticRebuttal?: string;
    debateWinner?: string;
    debateSummary?: string;
    searchResults?: any[];
    researchSummary?: any;
    engineUsage?: Record<string, number>;
    round?: number;
    timestamp: number;
  }>;
  isLoading?: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-indigo-600/10 dark:bg-indigo-400/10 mx-auto mb-5 flex items-center justify-center">
            <span className="text-5xl">💭</span>
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            说说你正在纠结什么
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            我会用"乐观派"和"悲观派"两种视角同时回答，帮你看清机会与风险。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {messages.map((message) => (
          <div key={message.id} className="mb-8">
            <MessageBubble question={message.question} timestamp={message.timestamp} />
            
            {message.searchResults && message.searchResults.length > 0 && message.researchSummary && (
              <ResearchResults 
                searchResults={message.searchResults}
                researchSummary={message.researchSummary}
                engineUsage={message.engineUsage || {}}
              />
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <PersonaCard
                emoji="😊"
                name="乐观派"
                answer={message.optimisticAnswer}
                rebuttal={message.optimisticRebuttal}
                theme="optimistic"
              />
              <PersonaCard
                emoji="😟"
                name="悲观派"
                answer={message.pessimisticAnswer}
                rebuttal={message.pessimisticRebuttal}
                theme="pessimistic"
              />
            </div>

            {message.debateWinner && (
              <DeciderResult 
                winner={message.debateWinner}
                summary={message.debateSummary || ''}
              />
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-center py-6">
            <div className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
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