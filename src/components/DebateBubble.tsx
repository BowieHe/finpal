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

  // User message (center/left aligned)
  if (type === 'user') {
    return (
      <div className="flex justify-center mb-6">
        <div className="max-w-[85%] bg-slate-100 dark:bg-slate-800 rounded-2xl px-5 py-3 text-center">
          <p className="text-slate-800 dark:text-slate-200 text-sm">{content}</p>
          {timestamp && (
            <span className="text-xs text-slate-400 mt-1 block">{formatTime(timestamp)}</span>
          )}
        </div>
      </div>
    );
  }

  const isOptimistic = type.includes('optimistic');
  const isRebuttal = type.includes('rebuttal');
  
  // Configuration for different types
  const config = {
    'optimistic-initial': {
      emoji: '😊',
      name: '乐观派',
      subtitle: '初始观点',
      bgColor: 'bg-emerald-500',
      lightBg: 'bg-emerald-50 dark:bg-emerald-500/10',
      textColor: 'text-emerald-700 dark:text-emerald-300',
      borderColor: 'border-emerald-200 dark:border-emerald-400/30',
      align: 'justify-end',
      bubbleColor: 'bg-emerald-500 text-white',
    },
    'pessimistic-initial': {
      emoji: '😟',
      name: '悲观派',
      subtitle: '初始观点',
      bgColor: 'bg-rose-500',
      lightBg: 'bg-rose-50 dark:bg-rose-500/10',
      textColor: 'text-rose-700 dark:text-rose-300',
      borderColor: 'border-rose-200 dark:border-rose-400/30',
      align: 'justify-start',
      bubbleColor: 'bg-rose-500 text-white',
    },
    'optimistic-rebuttal': {
      emoji: '😊',
      name: '乐观派',
      subtitle: '反驳',
      bgColor: 'bg-emerald-500',
      lightBg: 'bg-emerald-50/50 dark:bg-emerald-500/5',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-200 dark:border-emerald-400/20',
      align: 'justify-end',
      bubbleColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200',
    },
    'pessimistic-rebuttal': {
      emoji: '😟',
      name: '悲观派',
      subtitle: '反驳',
      bgColor: 'bg-rose-500',
      lightBg: 'bg-rose-50/50 dark:bg-rose-500/5',
      textColor: 'text-rose-600 dark:text-rose-400',
      borderColor: 'border-rose-200 dark:border-rose-400/20',
      align: 'justify-start',
      bubbleColor: 'bg-rose-100 text-rose-800 dark:bg-rose-400/20 dark:text-rose-200',
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
            <span className={`text-[10px] text-slate-400 mt-1 ${config.align === 'justify-end' ? 'text-right' : 'text-left'}`}>
              {formatTime(timestamp)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
