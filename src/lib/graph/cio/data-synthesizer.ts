import { GraphState, ResearchSummary, DataPoint, ResearchFinding } from '../state';
import { createLogger } from '../../logger';

const logger = createLogger('DataSynthesizer');

/**
 * Data Synthesizer 节点
 * 职责：在辩论开始前，将 collectedData 中分散的 Agent 结果聚合成 
 * 辩论专家能够理解的 researchSummary 和关键事实列表。
 */
export const dataSynthesizerNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  logger.info('Starting data synthesis for debate');
  
  const collectedData = state.collectedData || {};
  const existingSummary = state.researchSummary || { key_facts: [], data_points: [], summary: '' };
  const existingFindings = state.allFindings || [];
  
  let keyFacts: string[] = [...existingSummary.key_facts];
  let dataPoints: DataPoint[] = [...existingSummary.data_points];
  let allFindings: ResearchFinding[] = [...existingFindings];
  let summaryText = existingSummary.summary;

  // 1. 处理来自 DB-Agent 的结果
  Object.entries(collectedData).forEach(([key, result]) => {
    if (key.startsWith('db-agent_')) {
      if (result.status === 'success' && result.data) {
        if (result.task === 'portfolio_summary') {
          const summary = result.data;
          keyFacts.push(`[数据库] 用户当前持有 ${summary.holdings.length} 只基金，总投入 ${summary.totalCost} 元，总收益率 ${summary.totalProfitRate}%。`);
          summary.holdings.forEach((h: any) => {
            keyFacts.push(`[数据库持仓] ${h.fundCode} ${h.fundName}: 持有 ${h.shares.toFixed(2)} 份, 成本 ${h.costPrice}, 当前收益率 ${h.profitRate}%。`);
          });
        } else if (result.task === 'holding_detail') {
          const detail = result.data;
          keyFacts.push(`[数据库细节] 基金 ${detail.fundCode} (${detail.fundName}) 详细数据：持有天数 ${detail.holdingDays}，累计盈亏 ${detail.totalProfit}。`);
        } else if (result.task === 'risk_metrics') {
          const risk = result.data;
          keyFacts.push(`[量化风险] ${risk.fundCode} 近1年夏普比率: ${risk.sharpeRatio || 'N/A'}, 最大回撤: ${risk.maxDrawdown || 'N/A'}% (${risk.riskLevel})。`);
        }
      }
    }
    
    // 2. 处理来自 Web-Agent 的结果
    if (key.startsWith('web-agent_')) {
       if (result.status === 'success' || result.status === 'partial') {
         // 添加到关键事实
         const label = result.task === 'fund_info' ? '全网检索' : 
                       result.task === 'market_news' ? '市场动态' : 
                       result.task === 'fetch_page' ? '网页深读' : '搜索';
         
         const queryLabel = result.query || '未知查询';
         keyFacts.push(`[${label}] 搜索词 "${queryLabel}": ${result.summary || '已获取内容'}`);
       }
    }
  });

  // 3. 去重
  keyFacts = Array.from(new Set(keyFacts));

  // 4. 构建新的研究总结
  const newSummary: ResearchSummary = {
    key_facts: keyFacts,
    data_points: dataPoints,
    summary: summaryText || `系统已自动合成 ${keyFacts.length} 条关键情报。`
  };

  logger.info('Data synthesis completed', { 
    factsCount: keyFacts.length,
    newSummaryPreview: summaryText.substring(0, 50)
  });

  return {
    researchSummary: newSummary
  };
};
