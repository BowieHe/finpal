'use client';

import { useState } from 'react';
import { LLMConfig, SearchStrategy } from '@/types/config';

interface SettingsFormProps {
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
  onCancel: () => void;
}

const searchStrategyOptions: { value: SearchStrategy; label: string; description: string }[] = [
  { value: 'smart', label: '智能路由', description: '自动选择最佳搜索引擎' },
  { value: 'duckduckgo', label: 'DuckDuckGo', description: '免费、快速的搜索引擎' },
  { value: 'aliyun-websearch', label: '阿里云 Web Search', description: '需要 DASHSCOPE_API_KEY' },
  { value: 'open-websearch', label: 'Open Websearch', description: '基于 MCP 的搜索' },
];

export default function SettingsForm({ config, onSave, onCancel }: SettingsFormProps) {
  const [formData, setFormData] = useState<LLMConfig>({
    ...config,
    searchStrategy: config.searchStrategy || 'smart',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LLMConfig, string>>>({});
  const [showApiKey, setShowApiKey] = useState(false);

  const handleChange = (field: keyof LLMConfig, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Partial<Record<keyof LLMConfig, string>> = {};

    if (!formData.apiUrl.trim()) {
      newErrors.apiUrl = 'API URL 不能为空';
    } else {
      try {
        new URL(formData.apiUrl);
      } catch {
        newErrors.apiUrl = 'API URL 格式不正确';
      }
    }

    if (!formData.modelName.trim()) {
      newErrors.modelName = 'Model Name 不能为空';
    }

    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'API Key 不能为空';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          API URL
        </label>
        <input
          type="url"
          value={formData.apiUrl}
          onChange={(e) => handleChange('apiUrl', e.target.value)}
          placeholder="https://api.deepseek.com/v1"
          className={
            'w-full rounded-xl px-4 py-3 border bg-white dark:bg-slate-950 ' +
            'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 ' +
            'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 ' +
            (errors.apiUrl ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : '')
          }
        />
        {errors.apiUrl && (
          <p className="text-sm mt-1.5 text-red-600 dark:text-red-400">
            {errors.apiUrl}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          Model Name
        </label>
        <input
          type="text"
          value={formData.modelName}
          onChange={(e) => handleChange('modelName', e.target.value)}
          placeholder="deepseek-reasoner"
          className={
            'w-full rounded-xl px-4 py-3 border bg-white dark:bg-slate-950 ' +
            'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 ' +
            'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 ' +
            (errors.modelName ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : '')
          }
        />
        {errors.modelName && (
          <p className="text-sm mt-1.5 text-red-600 dark:text-red-400">
            {errors.modelName}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          API Key
        </label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={formData.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            placeholder="sk-..."
            className={
              'w-full rounded-xl px-4 py-3 pr-12 border bg-white dark:bg-slate-950 ' +
              'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 ' +
              'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 ' +
              (errors.apiKey ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : '')
            }
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
          >
            {showApiKey ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.apiKey && (
          <p className="text-sm mt-1.5 text-red-600 dark:text-red-400">
            {errors.apiKey}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
          搜索策略
        </label>
        <select
          value={formData.searchStrategy}
          onChange={(e) => setFormData((prev) => ({ ...prev, searchStrategy: e.target.value as SearchStrategy }))}
          className="w-full rounded-xl px-4 py-3 border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500"
        >
          {searchStrategyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>
        <p className="text-xs mt-1.5 text-slate-500 dark:text-slate-400">
          选择信息搜索时使用的搜索引擎策略
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5 shadow-sm"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-sm px-4 py-2.5"
        >
          取消
        </button>
      </div>
    </form>
  );
}
