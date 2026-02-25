'use client';

interface ChatInputProps {
  onSend: (question: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const question = formData.get('question') as string;
    if (question.trim()) {
      onSend(question);
      e.currentTarget.reset();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-slate-800/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto flex gap-3">
        <input
          type="text"
          name="question"
          placeholder="输入你的问题..."
          disabled={disabled}
          className="flex-1 px-4 py-3 rounded-lg bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200"
        >
          {disabled ? '思考中...' : '发送'}
        </button>
      </div>
    </form>
  );
}
