'use client';

import { useState } from 'react';
import { LLMConfig } from '@/types/config';

interface SettingsFormProps {
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
  onCancel: () => void;
}

export default function SettingsForm({ config, onSave, onCancel }: SettingsFormProps) {
  const [formData, setFormData] = useState<LLMConfig>(config);
  const [errors, setErrors] = useState<Partial<Record<keyof LLMConfig, string>>>({});

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
        <input
          type="password"
          value={formData.apiKey}
          onChange={(e) => handleChange('apiKey', e.target.value)}
          placeholder="sk-..."
          className={
            'w-full rounded-xl px-4 py-3 border bg-white dark:bg-slate-950 ' +
            'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 ' +
            'placeholder:text-slate-400 dark:placeholder:text-slate-600 ' +
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 ' +
            (errors.apiKey ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : '')
          }
        />
        {errors.apiKey && (
          <p className="text-sm mt-1.5 text-red-600 dark:text-red-400">
            {errors.apiKey}
          </p>
        )}
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
