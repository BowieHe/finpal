'use client';

interface MessageBubbleProps {
  question: string;
  timestamp: number;
}

export default function MessageBubble({ question, timestamp }: MessageBubbleProps) {
  const timeString = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="mx-4 sm:mx-6 md:mx-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 text-center">
            {timeString}
          </div>
          <div className="text-base text-slate-900 dark:text-slate-100 text-center leading-relaxed font-medium">
            {question}
          </div>
        </div>
      </div>
    </div>
  );
}
