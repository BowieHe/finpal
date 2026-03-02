'use client';

import { useState } from 'react';

interface ChatInputProps {
  onSend: (question: string, deepResearch: boolean) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [deepResearch, setDeepResearch] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const question = formData.get('question') as string;
    if (question.trim()) {
      onSend(question, deepResearch);
      e.currentTarget.reset();
      setDeepResearch(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 backdrop-blur"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        {/* Deep Research 开关 */}
        <div className="flex items-center gap-2 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deepResearch}
              onChange={(e) => setDeepResearch(e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Deep Research (深度研究)
            </span>
            {deepResearch && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                启用多轮搜索，耗时更长但结果更深入
              </span>
            )}
          </label>
        </div>
        
        <div className="flex gap-3">
          <input
            type="text"
            name="question"
            placeholder="输入你的问题..."
            disabled={disabled}
            className="flex-1 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {disabled ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                思考中...
              </>
            ) : (
              <>
                发送
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
