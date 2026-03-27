#!/usr/bin/env ts-node
/**
 * FinPal 搜索策略 autoResearch 训练脚本
 * 
 * 用法:
 *   pnpm ts-node autoresearch/search/train.ts           # 完整训练流程
 *   pnpm ts-node autoresearch/search/train.ts --baseline # 仅运行基线测试
 *   pnpm ts-node autoresearch/search/train.ts --test=exp-20250327-123045  # 重新运行指定实验
 */

import { runTestSuite, RunResult, testCases, getTestCasesByDifficulty } from '../eval/runner';
import { currentQueryConfig, baselineQueryConfig } from './config/query-config';
import { currentFilterConfig, baselineFilterConfig } from './config/filter-config';
import { 
  generateExperimentId, 
  saveExperiment, 
  loadBaseline, 
  setBaseline,
  calculateImprovement,
  generateExperimentReport,
  listExperiments
} from '../lib/experiment';
import { gitCommit, gitReset, hasUncommittedChanges, getCurrentCommit } from '../lib/git';
import { createLogger } from '@/lib/logger';
import * as readline from 'readline';

const logger = createLogger('Train');

// 配置
const EXPERIMENT_BUDGET = 20;  // 最多 20 次实验
const IMPROVEMENT_THRESHOLD = 0.05;  // 5% 提升阈值
const REGRESSION_THRESHOLD = -0.10;  // 10% 下降阈值

/**
 * 解析命令行参数
 */
function parseArgs(): { 
  baseline: boolean; 
  test?: string; 
  subset?: string;
  quick: boolean;
} {
  const args = process.argv.slice(2);
  return {
    baseline: args.includes('--baseline'),
    test: args.find(a => a.startsWith('--test='))?.split('=')[1],
    subset: args.find(a => a.startsWith('--subset='))?.split('=')[1],
    quick: args.includes('--quick'),
  };
}

/**
 * 询问用户输入
 */
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 打印实验结果表格
 */
function printResultsTable(result: RunResult) {
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│                      实验结果汇总                           │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ 实验ID:    ${result.experimentId.padEnd(49)}│`);
  console.log(`│ 测试数:    ${result.aggregateMetrics.totalTests.toString().padEnd(49)}│`);
  console.log(`│ 成功率:    ${`${result.aggregateMetrics.successCount}/${result.aggregateMetrics.totalTests}`.padEnd(49)}│`);
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ 质量指标                                                    │');
  console.log(`│   整体质量:     ${result.aggregateMetrics.avgQualityScore.toFixed(2).padEnd(8)}/10 │`);
  console.log(`│   信息相关性:   ${result.aggregateMetrics.avgRelevanceScore.toFixed(2).padEnd(8)}/10 │`);
  console.log(`│   信息完整性:   ${result.aggregateMetrics.avgCompletenessScore.toFixed(2).padEnd(8)}/10 │`);
  console.log(`│   表达清晰度:   ${result.aggregateMetrics.avgClarityScore.toFixed(2).padEnd(8)}/10 │`);
  console.log(`│   可执行性:     ${result.aggregateMetrics.avgActionabilityScore.toFixed(2).padEnd(8)}/10 │`);
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│ 效率指标                                                    │');
  console.log(`│   平均响应:     ${`${result.aggregateMetrics.avgDurationMs.toFixed(0)}ms`.padEnd(16)}│`);
  console.log(`│   Token 消耗:   ${result.aggregateMetrics.totalTokenUsage.toLocaleString().padEnd(16)}│`);
  console.log('└─────────────────────────────────────────────────────────────┘');
}

/**
 * 运行基线测试
 */
async function runBaseline(): Promise<RunResult> {
  console.log('📊 运行基线测试...');
  console.log('使用配置:', baselineQueryConfig.version);
  
  const experimentId = generateExperimentId();
  
  const result = await runTestSuite(
    experimentId,
    baselineQueryConfig,
    baselineFilterConfig,
    {
      onProgress: (completed, total, current) => {
        process.stdout.write(`\r  进度: ${completed}/${total} - ${current.id}`);
      }
    }
  );
  
  console.log('\n');
  printResultsTable(result);
  
  // 保存为基线
  await setBaseline(result);
  await saveExperiment(result);
  
  console.log('\n✅ 基线已设置并保存');
  console.log(`   实验ID: ${experimentId}`);
  
  return result;
}

/**
 * 运行单次实验
 */
async function runExperiment(
  experimentCount: number,
  bestScore: number
): Promise<{ result: RunResult; improvement: number; shouldCommit: boolean }> {
  const experimentId = generateExperimentId();
  
  console.log(`\n🔬 实验 ${experimentCount}/${EXPERIMENT_BUDGET}: ${experimentId}`);
  console.log('当前配置:', currentQueryConfig.version);
  
  // 显示配置变更
  console.log('\n配置参数:');
  console.log(`  查询数量: fund=${currentQueryConfig.fundAnalysis.queryCount}, portfolio=${currentQueryConfig.portfolioReview.queryCount}`);
  console.log(`  分析维度: ${currentQueryConfig.fundAnalysis.aspects.join(', ')}`);
  console.log(`  结果筛选: maxResults=${currentFilterConfig.limits.maxResults}`);
  
  // 运行测试
  console.log('\n运行测试套件...');
  const result = await runTestSuite(
    experimentId,
    currentQueryConfig,
    currentFilterConfig,
    {
      onProgress: (completed, total, current) => {
        process.stdout.write(`\r  进度: ${completed}/${total} - ${current.id}`);
      }
    }
  );
  
  console.log('\n');
  printResultsTable(result);
  
  // 计算改进
  const currentScore = result.aggregateMetrics.avgQualityScore;
  const improvement = bestScore > 0 ? (currentScore - bestScore) / bestScore : 0;
  
  console.log(`\n📈 与最佳基线对比:`);
  console.log(`   当前: ${currentScore.toFixed(2)} | 最佳: ${bestScore.toFixed(2)}`);
  console.log(`   改进: ${(improvement * 100).toFixed(1)}%`);
  
  // 决策
  const shouldCommit = improvement > IMPROVEMENT_THRESHOLD;
  const shouldReset = improvement < REGRESSION_THRESHOLD;
  
  if (shouldCommit) {
    console.log('\n✅ 显著提升！将提交修改');
  } else if (shouldReset) {
    console.log('\n❌ 显著下降，建议回滚');
  } else {
    console.log('\n➡️ 无明显变化');
  }
  
  // 保存实验结果
  await saveExperiment(result);
  
  return { result, improvement, shouldCommit };
}

/**
 * 主训练循环
 */
async function mainTrainingLoop() {
  console.log('🚀 FinPal 搜索策略 autoResearch 启动\n');
  
  // 检查 git 状态
  if (hasUncommittedChanges()) {
    console.log('⚠️ 检测到未提交的修改');
    const answer = await promptUser('是否提交当前修改并继续? (y/n): ');
    if (answer.toLowerCase() !== 'y') {
      console.log('已取消');
      return;
    }
    await gitCommit('chore: commit changes before autoResearch');
  }
  
  // 加载基线
  const baseline = await loadBaseline();
  let bestScore = baseline?.aggregateMetrics.avgQualityScore || 0;
  let bestCommit = getCurrentCommit();
  
  if (baseline) {
    console.log('📊 已加载基线:', baseline.experimentId);
    console.log('   基线质量分:', bestScore.toFixed(2));
  } else {
    console.log('⚠️ 未找到基线，请先运行: pnpm ts-node autoresearch/search/train.ts --baseline');
    const answer = await promptUser('是否现在运行基线测试? (y/n): ');
    if (answer.toLowerCase() === 'y') {
      const baselineResult = await runBaseline();
      bestScore = baselineResult.aggregateMetrics.avgQualityScore;
    } else {
      return;
    }
  }
  
  // 实验循环
  let experimentCount = 0;
  let consecutiveNoImprovement = 0;
  
  while (experimentCount < EXPERIMENT_BUDGET && consecutiveNoImprovement < 5) {
    experimentCount++;
    
    const { result, improvement, shouldCommit } = await runExperiment(experimentCount, bestScore);
    
    if (shouldCommit) {
      // 提交修改
      const commitMessage = `autoresearch: exp-${result.experimentId} improve quality by ${(improvement * 100).toFixed(1)}%`;
      const committed = await gitCommit(commitMessage);
      
      if (committed) {
        bestScore = result.aggregateMetrics.avgQualityScore;
        bestCommit = getCurrentCommit();
        consecutiveNoImprovement = 0;
        console.log('\n✅ 修改已提交，更新最佳基线');
      }
    } else if (improvement < REGRESSION_THRESHOLD) {
      // 回滚
      const answer = await promptUser('是否回滚到上一个提交? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        await gitReset();
        console.log('已回滚');
      }
      consecutiveNoImprovement++;
    } else {
      consecutiveNoImprovement++;
    }
    
    // 询问是否继续
    if (experimentCount < EXPERIMENT_BUDGET) {
      const answer = await promptUser('\n是否继续下一次实验? (y/n/exit): ');
      if (answer.toLowerCase() === 'exit' || answer.toLowerCase() === 'n') {
        break;
      }
      
      console.log('\n💡 提示: 请修改 autoresearch/search/config/query-config.ts 中的 currentQueryConfig');
      console.log('         或 autoresearch/search/config/filter-config.ts 中的 currentFilterConfig');
      await promptUser('修改完成后按回车继续...');
    }
  }
  
  // 总结
  console.log('\n🏁 训练结束');
  console.log(`   运行实验: ${experimentCount}/${EXPERIMENT_BUDGET}`);
  console.log(`   最佳质量分: ${bestScore.toFixed(2)}`);
  console.log(`   最佳提交: ${bestCommit}`);
  console.log('\n查看完整结果: autoresearch/search/experiments/');
}

/**
 * 快速测试模式
 */
async function runQuickTest() {
  console.log('⚡ 快速测试模式（3个简单用例）\n');
  
  const quickTests = getTestCasesByDifficulty('easy').slice(0, 3);
  const experimentId = generateExperimentId();
  
  const result = await runTestSuite(
    experimentId,
    currentQueryConfig,
    currentFilterConfig,
    {
      testCases: quickTests,
      onProgress: (completed, total, current) => {
        process.stdout.write(`\r进度: ${completed}/${total} - ${current.id}`);
      }
    }
  );
  
  console.log('\n');
  printResultsTable(result);
}

/**
 * 列出历史实验
 */
async function listHistory() {
  const experiments = await listExperiments();
  
  if (experiments.length === 0) {
    console.log('暂无实验记录');
    return;
  }
  
  console.log('\n📚 实验历史:\n');
  console.log('实验ID                    | 时间                | 质量分 | 相关性 | 耗时(ms)');
  console.log('--------------------------|---------------------|--------|--------|----------');
  
  for (const exp of experiments.slice(0, 10)) {
    const date = new Date(exp.timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    console.log(
      `${exp.experimentId.padEnd(25)} | ${date.padEnd(19)} | ` +
      `${exp.avgQualityScore.toFixed(2).padStart(6)} | ` +
      `${exp.avgRelevanceScore.toFixed(2).padStart(6)} | ` +
      `${exp.avgDurationMs.toFixed(0).padStart(8)}`
    );
  }
}

/**
 * 主函数
 */
async function main() {
  const args = parseArgs();
  
  try {
    if (args.baseline) {
      // 基线模式
      await runBaseline();
    } else if (args.test) {
      // 重新运行指定实验（使用当前配置）
      console.log(`重新运行实验: ${args.test}`);
      // TODO: 加载该实验的配置并重新运行
    } else if (args.quick) {
      // 快速测试
      await runQuickTest();
    } else if (args.subset) {
      // 运行子集
      console.log(`运行测试子集: ${args.subset}`);
      // TODO: 根据标签或难度运行子集
    } else {
      // 默认：完整训练流程
      await mainTrainingLoop();
    }
  } catch (error) {
    logger.error('训练过程出错', { error });
    console.error('\n❌ 错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 运行主函数
main();
