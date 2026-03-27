/**
 * 实验记录管理
 * 
 * 管理实验的历史记录、基线对比、结果持久化
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createLogger } from '@/lib/logger';
import { RunResult } from '../eval/runner';

const logger = createLogger('Experiment');

const EXPERIMENTS_DIR = join(process.cwd(), 'autoresearch', 'search', 'experiments');
const BASELINE_FILE = join(EXPERIMENTS_DIR, 'baseline.json');

/**
 * 生成实验 ID
 */
export function generateExperimentId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `exp-${dateStr}-${timeStr}`;
}

/**
 * 确保实验目录存在
 */
async function ensureExperimentsDir(): Promise<void> {
  try {
    await fs.mkdir(EXPERIMENTS_DIR, { recursive: true });
  } catch (error) {
    logger.error('创建实验目录失败', { error });
    throw error;
  }
}

/**
 * 保存实验结果
 */
export async function saveExperiment(result: RunResult): Promise<string> {
  await ensureExperimentsDir();
  
  const experimentDir = join(EXPERIMENTS_DIR, result.experimentId);
  await fs.mkdir(experimentDir, { recursive: true });
  
  const filePath = join(experimentDir, 'result.json');
  
  // 简化结果以减小文件大小
  const simplifiedResult = {
    ...result,
    results: result.results.map(r => ({
      testCaseId: r.testCase.id,
      category: r.testCase.category,
      question: r.testCase.question,
      durationMs: r.durationMs,
      searchEvaluation: r.searchEvaluation,
      reportEvaluation: r.reportEvaluation,
      tokenUsage: r.tokenUsage,
      error: r.error,
    })),
  };
  
  await fs.writeFile(filePath, JSON.stringify(simplifiedResult, null, 2), 'utf-8');
  
  logger.info('实验结果已保存', { 
    experimentId: result.experimentId, 
    filePath,
    avgQualityScore: result.aggregateMetrics.avgQualityScore 
  });
  
  return filePath;
}

/**
 * 加载实验结果
 */
export async function loadExperiment(experimentId: string): Promise<RunResult | null> {
  try {
    const filePath = join(EXPERIMENTS_DIR, experimentId, 'result.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as RunResult;
  } catch (error) {
    logger.error('加载实验结果失败', { error, experimentId });
    return null;
  }
}

/**
 * 设置基线
 */
export async function setBaseline(result: RunResult): Promise<void> {
  await ensureExperimentsDir();
  
  const baselineData = {
    experimentId: result.experimentId,
    timestamp: result.timestamp,
    aggregateMetrics: result.aggregateMetrics,
    config: result.config,
  };
  
  await fs.writeFile(BASELINE_FILE, JSON.stringify(baselineData, null, 2), 'utf-8');
  logger.info('基线已设置', { 
    experimentId: result.experimentId,
    avgQualityScore: result.aggregateMetrics.avgQualityScore 
  });
}

/**
 * 加载基线
 */
export async function loadBaseline(): Promise<{
  experimentId: string;
  timestamp: number;
  aggregateMetrics: RunResult['aggregateMetrics'];
  config: RunResult['config'];
} | null> {
  try {
    const content = await fs.readFile(BASELINE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.warn('未找到基线记录，将使用默认基线');
    return null;
  }
}

/**
 * 获取所有实验历史
 */
export async function listExperiments(): Promise<Array<{
  experimentId: string;
  timestamp: number;
  avgQualityScore: number;
  avgRelevanceScore: number;
  avgDurationMs: number;
}>> {
  try {
    await ensureExperimentsDir();
    const entries = await fs.readdir(EXPERIMENTS_DIR, { withFileTypes: true });
    
    const experiments: Array<{
      experimentId: string;
      timestamp: number;
      avgQualityScore: number;
      avgRelevanceScore: number;
      avgDurationMs: number;
    }> = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('exp-')) {
        const result = await loadExperiment(entry.name);
        if (result) {
          experiments.push({
            experimentId: result.experimentId,
            timestamp: result.timestamp,
            avgQualityScore: result.aggregateMetrics.avgQualityScore,
            avgRelevanceScore: result.aggregateMetrics.avgRelevanceScore,
            avgDurationMs: result.aggregateMetrics.avgDurationMs,
          });
        }
      }
    }
    
    // 按时间排序
    return experiments.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    logger.error('列出实验历史失败', { error });
    return [];
  }
}

/**
 * 计算与基线的改进
 */
export function calculateImprovement(
  current: RunResult['aggregateMetrics'],
  baseline: RunResult['aggregateMetrics']
): {
  qualityImprovement: number;      // 百分比
  relevanceImprovement: number;
  durationChange: number;
  overallScore: number;
} {
  const qualityImprovement = baseline.avgQualityScore > 0
    ? (current.avgQualityScore - baseline.avgQualityScore) / baseline.avgQualityScore
    : 0;
  
  const relevanceImprovement = baseline.avgRelevanceScore > 0
    ? (current.avgRelevanceScore - baseline.avgRelevanceScore) / baseline.avgRelevanceScore
    : 0;
  
  const durationChange = baseline.avgDurationMs > 0
    ? (current.avgDurationMs - baseline.avgDurationMs) / baseline.avgDurationMs
    : 0;
  
  // 综合评分（质量 + 相关性 - 时间成本）
  const overallScore = 
    qualityImprovement * 0.4 +
    relevanceImprovement * 0.4 -
    durationChange * 0.2;
  
  return {
    qualityImprovement,
    relevanceImprovement,
    durationChange,
    overallScore,
  };
}

/**
 * 生成实验报告
 */
export async function generateExperimentReport(
  experimentId: string
): Promise<string> {
  const result = await loadExperiment(experimentId);
  if (!result) {
    return '实验结果未找到';
  }
  
  const baseline = await loadBaseline();
  
  let report = `
# 实验报告: ${experimentId}

## 实验时间
${new Date(result.timestamp).toLocaleString('zh-CN')}

## 配置摘要
- Query Config: ${result.config.queryConfig.version}
- Filter Config: ${result.config.filterConfig.version}

## 实验结果

### 聚合指标
| 指标 | 当前值 | 基线值 | 变化 |
|------|--------|--------|------|
| 质量评分 | ${result.aggregateMetrics.avgQualityScore.toFixed(2)} | ${baseline ? baseline.aggregateMetrics.avgQualityScore.toFixed(2) : 'N/A'} | ${baseline ? ((result.aggregateMetrics.avgQualityScore - baseline.aggregateMetrics.avgQualityScore) / baseline.aggregateMetrics.avgQualityScore * 100).toFixed(1) + '%' : 'N/A'} |
| 相关性评分 | ${result.aggregateMetrics.avgRelevanceScore.toFixed(2)} | ${baseline ? baseline.aggregateMetrics.avgRelevanceScore.toFixed(2) : 'N/A'} | ${baseline ? ((result.aggregateMetrics.avgRelevanceScore - baseline.aggregateMetrics.avgRelevanceScore) / baseline.aggregateMetrics.avgRelevanceScore * 100).toFixed(1) + '%' : 'N/A'} |
| 完整度评分 | ${result.aggregateMetrics.avgCompletenessScore.toFixed(2)} | - | - |
| 清晰度评分 | ${result.aggregateMetrics.avgClarityScore.toFixed(2)} | - | - |
| 可执行性评分 | ${result.aggregateMetrics.avgActionabilityScore.toFixed(2)} | - | - |
| 平均响应时间 | ${result.aggregateMetrics.avgDurationMs.toFixed(0)}ms | ${baseline ? baseline.aggregateMetrics.avgDurationMs.toFixed(0) + 'ms' : 'N/A'} | ${baseline ? ((result.aggregateMetrics.avgDurationMs - baseline.aggregateMetrics.avgDurationMs) / baseline.aggregateMetrics.avgDurationMs * 100).toFixed(1) + '%' : 'N/A'} |
| Token 消耗 | ${result.aggregateMetrics.totalTokenUsage.toLocaleString()} | - | - |

### 测试统计
- 总测试数: ${result.aggregateMetrics.totalTests}
- 成功: ${result.aggregateMetrics.successCount}
- 失败: ${result.aggregateMetrics.failureCount}

## 详细结果

`;

  // 添加每个测试用例的结果
  for (const r of result.results.slice(0, 10)) {  // 只显示前10个
    report += `### ${r.testCase.id}: ${r.testCase.question.slice(0, 30)}...\n`;
    report += `- 质量: ${r.reportEvaluation.qualityScore}/10\n`;
    report += `- 相关性: ${r.reportEvaluation.relevanceScore}/10\n`;
    report += `- 耗时: ${r.durationMs}ms\n`;
    if (r.error) {
      report += `- ❌ 错误: ${r.error}\n`;
    }
    report += '\n';
  }
  
  return report;
}

/**
 * 导出实验历史为 CSV
 */
export async function exportExperimentsToCsv(): Promise<string> {
  const experiments = await listExperiments();
  
  if (experiments.length === 0) {
    return '没有实验记录';
  }
  
  const header = '实验ID,时间,质量评分,相关性评分,平均响应时间(ms)\n';
  const rows = experiments.map(e => 
    `${e.experimentId},${new Date(e.timestamp).toISOString()},${e.avgQualityScore.toFixed(2)},${e.avgRelevanceScore.toFixed(2)},${e.avgDurationMs.toFixed(0)}`
  ).join('\n');
  
  return header + rows;
}
