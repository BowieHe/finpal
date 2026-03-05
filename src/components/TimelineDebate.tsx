'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TypewriterText from './TypewriterText';

interface TimelineMessage {
  type: 'optimistic-initial' | 'pessimistic-initial' | 'optimistic-rebuttal' | 'pessimistic-rebuttal';
  content: string;
  thinking?: string;
  timestamp?: number;
}

interface TimelineDebateProps {
  messages: TimelineMessage[];
}

const personaConfig = {
  'optimistic-initial': {
    emoji: '😊',
    name: '乐观派',
    subtitle: '初始观点',
    side: 'right' as const,
    colors: {
      bg: 'bg-[#1C1B1A]',
      border: 'border-[#879A39]/30',
      text: 'text-[#879A39]',
      dot: 'bg-[#879A39]',
      line: 'bg-[#879A39]/50',
    },
  },
  'pessimistic-initial': {
    emoji: '😟',
    name: '悲观派',
    subtitle: '初始观点',
    side: 'left' as const,
    colors: {
      bg: 'bg-[#1C1B1A]',
      border: 'border-[#D14D41]/30',
      text: 'text-[#D14D41]',
      dot: 'bg-[#D14D41]',
      line: 'bg-[#D14D41]/50',
    },
  },
  'optimistic-rebuttal': {
    emoji: '😊',
    name: '乐观派',
    subtitle: '反驳',
    side: 'right' as const,
    colors: {
      bg: 'bg-[#1C1B1A]/80',
      border: 'border-[#879A39]/20',
      text: 'text-[#879A39]/80',
      dot: 'bg-[#879A39]/60',
      line: 'bg-[#879A39]/40',
    },
  },
  'pessimistic-rebuttal': {
    emoji: '😟',
    name: '悲观派',
    subtitle: '反驳',
    side: 'left' as const,
    colors: {
      bg: 'bg-[#1C1B1A]/80',
      border: 'border-[#D14D41]/20',
      text: 'text-[#D14D41]/80',
      dot: 'bg-[#D14D41]/60',
      line: 'bg-[#D14D41]/40',
    },
  },
};

function PersonaCard({ message }: { message: TimelineMessage }) {
  const [showThinking, setShowThinking] = useState(false);
  const config = personaConfig[message.type];
  const isRight = config.side === 'right';
  
  return (
    <div className={`w-[46%] ${isRight ? 'ml-[54%]' : 'mr-[54%]'} ${isRight ? 'text-right' : 'text-left'}`}>
      <div className={`${config.colors.bg} ${config.colors.border} border rounded-xl p-4 shadow-lg shadow-black/20 backdrop-blur-sm`}>
        <div className={`flex items-center gap-2 mb-3 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-8 h-8 rounded-full bg-[#282726] flex items-center justify-center text-lg">{config.emoji}</div>
          <div className={isRight ? 'text-right' : 'text-left'}>
            <div className={`text-sm font-medium ${config.colors.text}`}>{config.name}</div>
            <div className="text-xs text-[#6F6E69]">{config.subtitle}</div>
          </div>
        </div>
        
        {message.thinking && (
          <div className="mb-3">
            <button onClick={() => setShowThinking(!showThinking)} className={`flex items-center gap-1 text-xs text-[#6F6E69] hover:text-[#CECDC3] transition-colors ${isRight ? 'flex-row-reverse ml-auto' : 'flex-row'}`}>
              {showThinking ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>思考过程</span>
            </button>
            {showThinking && (
              <div className={`mt-2 p-3 rounded-lg bg-[#100F0F]/50 text-xs text-[#9F9D96] leading-relaxed border border-[#343331]/50 ${isRight ? 'text-right' : 'text-left'}`}>
                {message.thinking}
              </div>
            )}
          </div>
        )}
        
        <div className={`text-sm text-[#CECDC3] leading-relaxed whitespace-pre-wrap ${isRight ? 'text-right' : 'text-left'}`}>
          <TypewriterText text={message.content} speed={15} />
        </div>
        
        {message.timestamp && (
          <div className={`mt-2 text-xs text-[#6F6E69] ${isRight ? 'text-right' : 'text-left'}`}>
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}

function RoundContainer({ pair }: { pair: { round: number; optimistic: TimelineMessage | null; pessimistic: TimelineMessage | null } }) {
  const optimisticRef = useRef<HTMLDivElement>(null);
  const pessimisticRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  
  useEffect(() => {
    // Measure heights after render
    const optimisticHeight = optimisticRef.current?.offsetHeight || 0;
    const pessimisticHeight = pessimisticRef.current?.offsetHeight || 0;
    
    // Container height = max(optimistic, pessimistic + offset)
    // Pessimistic has 60px offset from top
    const pessimisticTotalHeight = pessimisticHeight > 0 ? pessimisticHeight + 60 : 0;
    const maxHeight = Math.max(optimisticHeight, pessimisticTotalHeight);
    
    setContainerHeight(maxHeight > 0 ? maxHeight : undefined);
  }, [pair]);
  
  return (
    <div 
      className="relative"
      style={{ height: containerHeight ? `${containerHeight}px` : 'auto' }}
    >
      {/* Optimistic card - normal flow */}
      {pair.optimistic && (
        <div ref={optimisticRef} className="relative">
          <PersonaCard message={pair.optimistic} />
          {/* Axis dot */}
          <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#879A39] border-2 border-[#100F0F] z-10 top-5" />
          {/* Connecting line */}
          <div className="absolute top-6 h-px bg-[#879A39]/50 left-1/2 ml-1.5" style={{ width: 'calc(8% - 6px)' }} />
        </div>
      )}
      
      {/* Pessimistic card - absolute positioned from top of container */}
      {pair.pessimistic && (
        <div ref={pessimisticRef} className="absolute left-0 right-0" style={{ top: '60px' }}>
          <PersonaCard message={pair.pessimistic} />
          {/* Axis dot */}
          <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#D14D41] border-2 border-[#100F0F] z-10 top-5" />
          {/* Connecting line */}
          <div className="absolute top-6 h-px bg-[#D14D41]/50 right-1/2 mr-1.5" style={{ width: 'calc(8% - 6px)' }} />
        </div>
      )}
    </div>
  );
}

export function TimelineDebate({ messages }: TimelineDebateProps) {
  if (messages.length === 0) return null;
  
  // Group messages into rounds
  const pairs = [];
  let currentRound = { round: 1, optimistic: null as TimelineMessage | null, pessimistic: null as TimelineMessage | null };
  
  messages.forEach((msg) => {
    if (msg.type === 'optimistic-initial' || msg.type === 'pessimistic-initial') {
      if (currentRound.round !== 1) {
        pairs.push(currentRound);
        currentRound = { round: 1, optimistic: null, pessimistic: null };
      }
      if (msg.type === 'optimistic-initial') currentRound.optimistic = msg;
      else currentRound.pessimistic = msg;
    } else {
      if (currentRound.round !== 2) {
        pairs.push(currentRound);
        currentRound = { round: 2, optimistic: null, pessimistic: null };
      }
      if (msg.type === 'optimistic-rebuttal') currentRound.optimistic = msg;
      else currentRound.pessimistic = msg;
    }
  });
  pairs.push(currentRound);
  
  return (
    <div className="relative py-8">
      {/* Center axis */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gradient-to-b from-[#879A39] via-[#575653] to-[#D14D41]" />
      
      {/* Round containers */}
      <div className="space-y-8">
        {pairs.map((pair) => (
          <RoundContainer key={pair.round} pair={pair} />
        ))}
      </div>
    </div>
  );
}
