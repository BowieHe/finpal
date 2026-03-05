'use client';

interface DebateBubbleProps {
  type: 'optimistic-initial' | 'pessimistic-initial' | 'optimistic-rebuttal' | 'pessimistic-rebuttal' | 'user';
  content: string;
  thinking?: string;
  timestamp?: number;
}

export default function DebateBubble({ type, content, thinking, timestamp }: DebateBubbleProps) {
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // User message (center aligned with Flexoki colors)
  if (type === 'user') {
    return (
      <div className="flex justify-center mb-6">
        <div className="max-w-[85%] bg-[#282726] rounded-2xl px-5 py-3 text-center border border-[#343331] relative">
          <p className="text-[#CECDC3] text-sm">{content}</p>
          {timestamp && (
            <span className="text-[10px] text-[#6F6E69] absolute bottom-1 right-3">{formatTime(timestamp)}</span>
          )}
        </div>
      </div>
    );
  }

  const isOptimistic = type.includes('optimistic');
  const isRebuttal = type.includes('rebuttal');
  
  // Flexoki color configuration
  const config = {
    'optimistic-initial': {
      emoji: '😊',
      name: '乐观派',
      subtitle: '初始观点',
      bgColor: 'bg-[#879A39]',
      lightBg: 'bg-[#879A39]/10',
      textColor: 'text-[#879A39]',
      borderColor: 'border-[#879A39]/30',
      align: 'justify-end',
      bubbleColor: 'bg-[#879A39] text-[#100F0F]',
    },
    'pessimistic-initial': {
      emoji: '😟',
      name: '悲观派',
      subtitle: '初始观点',
      bgColor: 'bg-[#D14D41]',
      lightBg: 'bg-[#D14D41]/10',
      textColor: 'text-[#D14D41]',
      borderColor: 'border-[#D14D41]/30',
      align: 'justify-start',
      bubbleColor: 'bg-[#D14D41] text-[#100F0F]',
    },
    'optimistic-rebuttal': {
      emoji: '😊',
      name: '乐观派',
      subtitle: '反驳',
      bgColor: 'bg-[#879A39]/80',
      lightBg: 'bg-[#879A39]/5',
      textColor: 'text-[#879A39]/80',
      borderColor: 'border-[#879A39]/20',
      align: 'justify-end',
      bubbleColor: 'bg-[#879A39]/20 text-[#879A39] border border-[#879A39]/30',
    },
    'pessimistic-rebuttal': {
      emoji: '😟',
      name: '悲观派',
      subtitle: '反驳',
      bgColor: 'bg-[#D14D41]/80',
      lightBg: 'bg-[#D14D41]/5',
      textColor: 'text-[#D14D41]/80',
      borderColor: 'border-[#D14D41]/20',
      align: 'justify-start',
      bubbleColor: 'bg-[#D14D41]/20 text-[#D14D41] border border-[#D14D41]/30',
    },
  }[type];

  return (
    <div className={`flex ${config.align} mb-4`}>
      <div className={`max-w-[80%] ${config.align === 'justify-start' ? 'flex-row' : 'flex-row-reverse'} flex items-start gap-2`}>
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
          {config.emoji}
        </div>
        
        {/* Bubble */}
        <div className="flex flex-col">
          {/* Name label */}
          <span className={`text-xs ${config.textColor} mb-1 ${config.align === 'justify-end' ? 'text-right' : 'text-left'}`}>
            {config.name} · {config.subtitle}
          </span>
          
          {/* Thinking (if available) */}
          {thinking && !isRebuttal && (
            <div className={`text-xs ${config.lightBg} ${config.textColor} p-2 rounded-lg mb-1 border ${config.borderColor}`}>
              <span className="opacity-70">💭 {thinking}</span>
            </div>
          )}
          
          {/* Main content bubble */}
          <div className={`${config.bubbleColor} px-4 py-3 rounded-2xl shadow-sm whitespace-pre-wrap leading-relaxed text-sm`}>
            {content}
          </div>
          
          {/* Timestamp */}
          {timestamp && (
            <span className={`text-[10px] text-[#6F6E69] mt-1 ${config.align === 'justify-end' ? 'text-right' : 'text-left'}`}>
              {formatTime(timestamp)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
