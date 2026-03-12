'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { LLMConfig } from '@/types/config';

interface ScreenshotUploadProps {
  onAnalysisComplete?: (data: any) => void;
  config?: LLMConfig; // 从前端传入的配置
}

export default function ScreenshotUpload({ onAnalysisComplete, config }: ScreenshotUploadProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setError(null);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    // 检查配置
    if (!config || !config.apiKey) {
      setError('请先配置 API Key');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: selectedImage,
          config: config, // 传递配置给后端
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || '分析失败');
      }

      setResult(data.data);
      onAnalysisComplete?.(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* 上传区域 */}
      <div
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-colors duration-200
          ${selectedImage 
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20' 
            : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600'
          }
        `}
        onClick={() => !selectedImage && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedImage ? (
          <div className="relative">
            <img
              src={selectedImage}
              alt="Selected screenshot"
              className="max-h-64 mx-auto rounded-lg shadow-lg"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-slate-900 dark:text-slate-100 font-medium">
                点击上传基金截图
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                支持 JPG、PNG 格式，最大 5MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {selectedImage && !isAnalyzing && !result && (
        <button
          onClick={handleAnalyze}
          disabled={!config?.apiKey}
          className={`
            w-full py-3 px-4 font-medium rounded-xl transition-colors flex items-center justify-center gap-2
            ${config?.apiKey 
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          <ImageIcon size={18} />
          {config?.apiKey ? '分析截图' : '请先配置 API Key'}
        </button>
      )}

      {/* 分析中状态 */}
      {isAnalyzing && (
        <div className="flex items-center justify-center gap-2 py-4 text-slate-600 dark:text-slate-400">
          <Loader2 className="animate-spin" size={20} />
          <span>正在分析截图...</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 分析结果 */}
      {result && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            分析结果
          </h3>
          
          {result.funds && result.funds.length > 0 ? (
            <div className="space-y-3">
              {result.funds.map((fund: any, index: number) => (
                <div
                  key={index}
                  className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {fund.name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {fund.code}
                      </p>
                    </div>
                    <span className={`
                      px-2 py-1 text-xs rounded-full
                      ${fund.profitRate && fund.profitRate > 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : fund.profitRate && fund.profitRate < 0
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }
                    `}>
                      {fund.profitRate > 0 ? '+' : ''}{fund.profitRate}%
                    </span>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">持仓份额:</span>
                      <span className="ml-2 text-slate-900 dark:text-slate-100">{fund.shares}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">持有收益:</span>
                      <span className={`
                        ml-2 font-medium
                        ${fund.profit > 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : fund.profit < 0 
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }
                      `}>
                        {fund.profit > 0 ? '+' : ''}{fund.profit}
                      </span>
                    </div>
                  </div>

                  {fund.chartTrend && (
                    <div className="mt-2 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">趋势:</span>
                      <span className="ml-2 text-slate-900 dark:text-slate-100">
                        {fund.chartTrend === 'up' && '📈 上涨'}
                        {fund.chartTrend === 'down' && '📉 下跌'}
                        {fund.chartTrend === 'volatile' && '📊 震荡'}
                        {fund.chartTrend === 'stable' && '➡️ 平稳'}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {result.totalProfit !== undefined && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-900 dark:text-slate-100">总收益</span>
                    <span className={`
                      text-lg font-bold
                      ${result.totalProfit > 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : result.totalProfit < 0 
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }
                    `}>
                      {result.totalProfit > 0 ? '+' : ''}{result.totalProfit}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 dark:text-slate-400">
              {result.rawResponse ? (
                <pre className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-800 p-4 rounded-lg overflow-auto max-h-64">
                  {result.rawResponse}
                </pre>
              ) : (
                <p>未能识别到基金信息，请确保截图包含基金持仓页面</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
