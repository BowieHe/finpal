'use client';

import { useRef } from 'react';


interface ChatInputProps {
  onSend: (question: string) => void;
  disabled: boolean;
  onStop?: () => void;
}

export default function ChatInput({ onSend, disabled, onStop }: ChatInputProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const question = formData.get('question') as string;
    if (question.trim()) {
      onSend(question);
      e.currentTarget.reset();
      
      // Reset textarea height after sending
      const textarea = e.currentTarget.querySelector('textarea');
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto'; // Reset the height first to shrink if text was deleted
    target.style.height = `${target.scrollHeight}px`; // Set to the newly computed scrollHeight
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 backdrop-blur"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        
        <div className="flex gap-3">
          <div className="flex-1 relative flex items-end">
            <textarea
              name="question"
              placeholder="输入你的问题... (Shift + Enter 换行)"
              disabled={disabled}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none max-h-48 overflow-y-auto whitespace-pre-wrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
            />
          </div>
          {disabled ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 hover:bg-red-600 dark:bg-slate-700 dark:hover:bg-red-600 text-white font-semibold text-sm px-6 py-3 shadow-sm transition-colors group"
              title="中断当前任务"
            >
              <div className="w-3 h-3 bg-red-400 group-hover:bg-white rounded-sm transition-colors shadow-[0_0_8px_rgba(248,113,113,0.8)] group-hover:shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
              中断
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              发送
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
