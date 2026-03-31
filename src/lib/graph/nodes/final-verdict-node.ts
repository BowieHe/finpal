import { GraphState } from '../state';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FinalVerdictNode');

/**
 * 将 DeepAgent 推荐转换为标准格式
 */
function normalizeRecommendation(
  rec: string | undefined
): 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'avoid' | 'info_only' {
  if (!rec) return 'info_only';
  const lower = rec.toLowerCase();
  if (lower.includes('strong_buy') || lower.includes('strong buy')) return 'strong_buy';
  if (lower.includes('buy')) return 'buy';
  if (lower.includes('hold')) return 'hold';
  if (lower.includes('reduce') || lower.includes('sell')) return 'reduce';
  if (lower.includes('avoid')) return 'avoid';
  return 'info_only';
}

/**
 * Final Verdict Node - 完整版
 *
 * DeepAgent 已经完成了所有分析和辩论，这个节点负责：
 * 1. 格式化最终输出
 * 2. 发送进度回调（包含完整的 final_verdict 数据）
 * 3. 确保数据结构完整
 */
export const finalVerdictNode = async (
  state: GraphState
): Promise<Partial<GraphState>> => {
  const startTime = Date.now();
  logger.info('Final verdict node', { question: state.question });

  if (state.progressCallback) {
    state.progressCallback({
      type: 'node_start',
      data: { node: 'finalVerdict', message: '生成最终报告...' },
    });
  }

  // 从 DeepAgent 结果中提取数据
  const optimisticData = state.optimisticData;
  const pessimisticData = state.pessimisticData;
  const researchSummary = state.researchSummary;
  const researchBoard = researchSummary?.research_board;

  // 构建 bullPoints（看涨观点）
  const bullPoints: string[] = [];
  if (optimisticData?.catalysts) {
    bullPoints.push(...optimisticData.catalysts.map(c =>
      typeof c === 'string' ? c : c.description
    ));
  }
  const latestBullContent = state.debateRounds
    .map((round) => round.optimistic?.content)
    .filter((content): content is string => Boolean(content))
    .at(-1);
  if (latestBullContent && !bullPoints.includes(latestBullContent)) {
    bullPoints.unshift(latestBullContent);
  }

  // 构建 bearPoints（看跌观点）
  const bearPoints: string[] = [];
  if (pessimisticData?.riskFactors) {
    bearPoints.push(...pessimisticData.riskFactors.map(r =>
      typeof r === 'string' ? r : r.description
    ));
  }
  const latestBearContent = state.debateRounds
    .map((round) => round.pessimistic?.content)
    .filter((content): content is string => Boolean(content))
    .at(-1);
  if (latestBearContent && !bearPoints.includes(latestBearContent)) {
    bearPoints.unshift(latestBearContent);
  }

  // 构建 riskWarnings（风险提示）
  const riskWarnings: string[] = [];
  if (pessimisticData?.riskFactors) {
    riskWarnings.push(...pessimisticData.riskFactors.map(r =>
      typeof r === 'string' ? r : r.description
    ));
  }
  if (optimisticData?.keyRisks) {
    riskWarnings.push(...optimisticData.keyRisks);
  }

  // 构建 sources（来源）
  const sources: string[] = [];
  if (researchSummary?.data_points) {
    sources.push(...researchSummary.data_points.map(dp => dp.source));
  }
  if (researchBoard?.knownFacts) {
    sources.push(...researchBoard.knownFacts.map(item => item.source));
  }
  // 去重
  const uniqueSources = [...new Set(sources)];

  const coveredGaps = (researchBoard?.coveredGaps || []).map(item => item.gap);
  const remainingGaps = researchBoard?.informationGaps || [];
  const researchBasis = [
    ...(researchBoard?.knownFacts || []).slice(0, 5).map(item => item.claim),
    ...(researchSummary?.key_facts || []).slice(0, 3),
  ].filter(Boolean);

  const finalSummary = state.debateSummary
    || researchSummary?.summary
    || [
      coveredGaps.length > 0 ? `已覆盖关键研究缺口：${coveredGaps.join('、')}` : '',
      remainingGaps.length > 0 ? `仍待补充：${remainingGaps.join('、')}` : '',
      researchBoard?.stopReason ? `停止原因：${researchBoard.stopReason}` : '',
    ].filter(Boolean).join('\n\n')
    || '分析完成';

  // 确定推荐和置信度
  const recommendation = normalizeRecommendation(
    state.debateWinner === 'optimistic' ? 'buy' :
    state.debateWinner === 'pessimistic' ? 'reduce' : 'hold'
  );

  const confidence = optimisticData?.confidenceLevel ||
                    pessimisticData?.confidenceLevel ||
                    50;

  // 发送完整的 final_verdict 事件
  if (state.progressCallback) {
    state.progressCallback({
      type: 'final_verdict',
      data: {
        summary: finalSummary,
        recommendation,
        confidence,
        bullPoints: bullPoints.length > 0 ? bullPoints : ['暂无明确看涨观点'],
        bearPoints: bearPoints.length > 0 ? bearPoints : ['暂无明确看跌观点'],
        riskWarnings: riskWarnings.length > 0 ? riskWarnings : ['请注意投资风险'],
        sources: uniqueSources.length > 0 ? uniqueSources : ['AI分析'],
        researchBasis,
        coveredGaps,
        remainingGaps,
        searchStopReason: researchBoard?.stopReason,
      },
    });

    // 发送 complete 事件
    state.progressCallback({
      type: 'complete',
      data: {
        message: '分析完成',
        winner: state.debateWinner,
        summary: finalSummary,
      },
    });
  }

  logger.info('Final verdict completed', { duration: Date.now() - startTime });

  // 返回空对象，因为数据已经在 state 中
  return {};
};
