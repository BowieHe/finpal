/**
 * DB-Agent — 数据库持仓查询专员
 *
 * 职责：唯一负责所有与数据库相关的查询。
 * 约束：不联网，不分析，不调用 LLM，只返回结构化数据。
 * 性能目标：响应时间 < 500ms
 */

import { DBAgentInput, DBAgentOutput } from './types';
import { getPortfolioSummary, getHoldingDetail } from '../tools/portfolio';
import { compareFunds } from '../tools/comparison';
import { getFundRiskMetrics } from '../tools/risk';
import { createLogger } from '../logger';
import { dbAgentSchema } from './db-agent-schema';

const logger = createLogger('DBAgent');

/**
 * DB-Agent 主函数
 *
 * 根据 task 类型路由到对应的数据库查询工具，
 * 统一封装异常处理和耗时记录。
 */
export async function dbAgent(input: DBAgentInput): Promise<DBAgentOutput> {
  const startTime = Date.now();
  const { task, params } = input;

  logger.info('DB-Agent started', { task, params });

  try {
    let data: unknown;

    switch (task) {
      case 'portfolio_summary': {
        input.onProgress?.('正在生成 SQL 查询持仓汇总结构...');
        input.onProgress?.('SQL: SELECT fund_id, shares, total_cost FROM holdings;');
        data = await getPortfolioSummary();
        input.onProgress?.('执行 SQL 查询完毕，正在整理持仓数据...');
        break;
      }

      case 'holding_detail': {
        if (!params.fundCode) {
          throw new Error('holding_detail requires params.fundCode');
        }
        input.onProgress?.(`正在生成 SQL 查询特定基金详情...`);
        input.onProgress?.(`SQL: SELECT * FROM holdings WHERE fund_code = '${params.fundCode}';`);
        data = await getHoldingDetail(params.fundCode);
        input.onProgress?.(`基金 ${params.fundCode} 持仓数据提取完毕...`);
        break;
      }

      case 'compare_funds': {
        const codes = params.fundCodes ?? (params.fundCode ? [params.fundCode] : []);
        if (codes.length === 0) {
          throw new Error('compare_funds requires at least one fund code in params.fundCodes');
        }
        input.onProgress?.(`准备对比分析基金: ${codes.join(', ')}`);
        input.onProgress?.(`SQL: SELECT * FROM funds WHERE fund_code IN (${codes.map(c => `'${c}'`).join(', ')});`);
        data = await compareFunds(codes);
        input.onProgress?.(`基金对比数据处理完成...`);
        break;
      }

      case 'risk_metrics': {
        if (!params.fundCode) {
          throw new Error('risk_metrics requires params.fundCode');
        }
        input.onProgress?.(`计算风险指标中 (期间: ${params.period ?? '1y'})...`);
        input.onProgress?.(`SQL: SELECT date, nav FROM fund_navs WHERE fund_code = '${params.fundCode}' AND date >= ...`);
        data = await getFundRiskMetrics(params.fundCode, params.period ?? '1y');
        input.onProgress?.(`历史净值风险模型计算完毕...`);
        break;
      }

      default: {
        throw new Error(`Unknown DB-Agent task: ${task}`);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info('DB-Agent completed', { task, durationMs });

    return {
      agentId: 'db-agent',
      task,
      status: 'success',
      data,
      durationMs,
      schema: dbAgentSchema,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('DB-Agent failed', { task, error: errorMessage, durationMs });

    return {
      agentId: 'db-agent',
      task,
      status: 'error',
      data: null,
      error: errorMessage,
      durationMs,
      schema: dbAgentSchema,
    };
  }
}
