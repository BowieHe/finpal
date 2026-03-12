'use client';

import { useState } from 'react';
import { X, Plus, Upload, Camera, Loader2 } from 'lucide-react';
import ScreenshotUpload from './ScreenshotUpload';

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHolding: (holding: HoldingData) => void;
}

export interface HoldingData {
  fundCode: string;
  fundName: string;
  shares: number;
  costPrice: number;
  buyDate: string;
}

export default function AddHoldingModal({ isOpen, onClose, onAddHolding }: AddHoldingModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'image'>('manual');
  const [formData, setFormData] = useState<HoldingData>({
    fundCode: '',
    fundName: '',
    shares: 0,
    costPrice: 0,
    buyDate: new Date().toISOString().split('T')[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recognizedFunds, setRecognizedFunds] = useState<any[]>([]);
  const [selectedFundIndex, setSelectedFundIndex] = useState<number>(0);

  if (!isOpen) return null;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fundCode || formData.shares <= 0 || formData.costPrice <= 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddHolding(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageAnalysisComplete = (data: any) => {
    if (data.funds && data.funds.length > 0) {
      setRecognizedFunds(data.funds);
      // 预填充第一个基金的表单
      const firstFund = data.funds[0];
      setFormData({
        fundCode: firstFund.code || '',
        fundName: firstFund.name || '',
        shares: firstFund.shares || 0,
        costPrice: firstFund.costPrice || 0,
        buyDate: new Date().toISOString().split('T')[0],
      });
    }
  };

  const handleSelectFund = (index: number) => {
    setSelectedFundIndex(index);
    const fund = recognizedFunds[index];
    setFormData({
      fundCode: fund.code || '',
      fundName: fund.name || '',
      shares: fund.shares || 0,
      costPrice: fund.costPrice || 0,
      buyDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleImageSubmit = async () => {
    if (!formData.fundCode) return;

    setIsSubmitting(true);
    try {
      await onAddHolding(formData);
      setRecognizedFunds([]);
      setSelectedFundIndex(0);
      setFormData({
        fundCode: '',
        fundName: '',
        shares: 0,
        costPrice: 0,
        buyDate: new Date().toISOString().split('T')[0],
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            添加持仓
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'manual'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Plus size={16} />
            手动输入
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'image'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Camera size={16} />
            截图识别
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  基金代码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fundCode}
                  onChange={(e) => setFormData({ ...formData, fundCode: e.target.value })}
                  placeholder="例如：000001"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  基金名称
                </label>
                <input
                  type="text"
                  value={formData.fundName}
                  onChange={(e) => setFormData({ ...formData, fundName: e.target.value })}
                  placeholder="例如：华夏成长混合"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    持仓份额 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.shares || ''}
                    onChange={(e) => setFormData({ ...formData, shares: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    持仓成本 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.costPrice || ''}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    step="0.0001"
                    min="0"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  买入日期
                </label>
                <input
                  type="date"
                  value={formData.buyDate}
                  onChange={(e) => setFormData({ ...formData, buyDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 mt-6"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    添加中...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    添加持仓
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {!recognizedFunds.length ? (
                <ScreenshotUpload onAnalysisComplete={handleImageAnalysisComplete} />
              ) : (
                <div className="space-y-4">
                  {/* 识别的基金列表 */}
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                      识别到的基金（选择要添加的）
                    </h3>
                    <div className="space-y-2">
                      {recognizedFunds.map((fund, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectFund(index)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedFundIndex === index
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {fund.name}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {fund.code}
                              </p>
                            </div>
                            {fund.profitRate !== undefined && (
                              <span className={`
                                px-2 py-1 text-xs rounded-full
                                ${fund.profitRate > 0
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                }
                              `}>
                                {fund.profitRate > 0 ? '+' : ''}{fund.profitRate}%
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 编辑表单 */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                      确认信息
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          基金代码
                        </label>
                        <input
                          type="text"
                          value={formData.fundCode}
                          onChange={(e) => setFormData({ ...formData, fundCode: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          持仓份额
                        </label>
                        <input
                          type="number"
                          value={formData.shares || ''}
                          onChange={(e) => setFormData({ ...formData, shares: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        持仓成本
                      </label>
                      <input
                        type="number"
                        value={formData.costPrice || ''}
                        onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setRecognizedFunds([]);
                        setSelectedFundIndex(0);
                      }}
                      className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      重新上传
                    </button>
                    <button
                      onClick={handleImageSubmit}
                      disabled={isSubmitting || !formData.fundCode}
                      className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          添加中...
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          确认添加
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
