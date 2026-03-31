/**
 * DeepAgent - 基金分析智能体
 * 
 * 自主推理的智能体，能够规划、执行 Skills 并根据结果迭代
 * 
 * @example
 * ```typescript
 * import { createDeepAgent, runFundAnalysis } from '@/lib/deepagent';
 * 
 * const agent = await createDeepAgent();
 * const result = await runFundAnalysis("分析泡泡玛特", "泡泡玛特");
 * 
 * console.log(result.data.synthesis.recommendation);
 * ```
 */

// 核心类型
export type {
  DeepAgentConfig,
  DeepAgentState,
  DeepAgentResult,
  Decision,
  Thought,
  Action,
  Observation,
  AgentContext,
  SkillInput,
  SkillOutput,
  ProgressEvent,
  ObservationContext,
} from './core/types';

// Skill 类型
export type {
  ISkill,
  SkillMetadata,
  FundDeepSearchInput,
  FundDeepSearchData,
  FundDebateInput,
  FundDebateData,
} from './skills/types';

// DeepAgent 主类
export { DeepAgent } from './core/agent';

// Skill Registry
export { SkillRegistry, skillRegistry } from './skills/registry';

// Skills
export { FundDeepSearchSkill, fundDeepSearchSkill } from './skills/fund-deep-search';
export { FundDebateSkill, fundDebateSkill } from './skills/fund-debate';
export { DbAgentSkill, dbAgentSkill } from './skills/db-agent';

import { getLLMInstance } from '@/lib/llm/client';
import { createLogger } from '@/lib/logger';
import { DeepAgent } from './core/agent';
import { fundDeepSearchSkill } from './skills/fund-deep-search';
import { fundDebateSkill } from './skills/fund-debate';
import { dbAgentSkill } from './skills/db-agent';
import { DeepAgentConfig, DeepAgentResult, ProgressEvent, SkillInput, SkillOutput } from './core/types';

const logger = createLogger('DeepAgentAPI');

/**
 * 创建配置好的 DeepAgent 实例
 * 
 * 自动注册默认 Skills: fund-deep-search, fund-debate
 */
export async function createDeepAgent(
  config?: Partial<Omit<DeepAgentConfig, 'llm'>>
): Promise<DeepAgent> {
  const llm = await getLLMInstance();
  
  const agent = new DeepAgent({
    llm,
    maxSteps: config?.maxSteps ?? 20,
    confidenceThreshold: config?.confidenceThreshold ?? 0.6,
    searchSkillLimit: config?.searchSkillLimit ?? 5,
    onProgress: config?.onProgress,
  });

  // 注册默认 Skills
  agent.registerSkill(fundDeepSearchSkill);
  agent.registerSkill(fundDebateSkill);
  agent.registerSkill(dbAgentSkill);

  logger.info('DeepAgent created with default skills', {
    maxSteps: config?.maxSteps ?? 20,
    confidenceThreshold: config?.confidenceThreshold ?? 0.6,
    searchSkillLimit: config?.searchSkillLimit ?? 5,
  });

  return agent;
}

/**
 * 运行基金分析
 * 
 * 便捷的入口函数，自动创建 Agent 并执行分析
 */
export async function runFundAnalysis(
  goal: string,
  entity: string,
  options?: {
    maxSteps?: number;
    confidenceThreshold?: number;
    searchSkillLimit?: number;
    onProgress?: (event: ProgressEvent) => void;
  }
): Promise<DeepAgentResult> {
  const agent = await createDeepAgent({
    maxSteps: options?.maxSteps,
    confidenceThreshold: options?.confidenceThreshold,
    searchSkillLimit: options?.searchSkillLimit,
    onProgress: options?.onProgress,
  });

  return agent.execute(goal, entity);
}

/**
 * 创建自定义配置的 DeepAgent
 * 
 * 允许传入自定义 Skills
 */
export async function createCustomAgent(
  skills: Array<{ name: string; description: string; execute: (input: SkillInput) => Promise<SkillOutput> }>,
  config?: Partial<Omit<DeepAgentConfig, 'llm'>>
): Promise<DeepAgent> {
  const llm = await getLLMInstance();
  
  const agent = new DeepAgent({
    llm,
    maxSteps: config?.maxSteps ?? 20,
    confidenceThreshold: config?.confidenceThreshold ?? 0.6,
    searchSkillLimit: config?.searchSkillLimit ?? 5,
    onProgress: config?.onProgress,
  });

  // 注册自定义 Skills
  for (const skill of skills) {
    agent.registerSkill({
      metadata: {
        name: skill.name,
        description: skill.description,
      },
      execute: skill.execute,
    });
  }

  return agent;
}
