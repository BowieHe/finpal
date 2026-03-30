/**
 * DeepAgent 主类
 * 
 * 实现自主推理的智能体，能够规划、执行 Skills 并根据结果迭代
 */

import { ChatOpenAI } from '@langchain/openai';
import { createLogger } from '@/lib/logger';
import {
  DeepAgentConfig,
  DeepAgentState,
  DeepAgentResult,
  Decision,
  Thought,
  Action,
  Observation,
  AgentContext,
  SkillOutput,
  ProgressEvent,
  ObservationContext,
} from './types';
import { ISkill } from '../skills/types';
import { SkillRegistry } from '../skills/registry';
import { buildObservationPrompt, buildFinalizationPrompt, parseDecision } from './prompt';
import { dbAgentSchema, formatDbSchemaForPrompt } from '@/lib/agents/db-agent-schema';

const logger = createLogger('DeepAgent');

/**
 * DeepAgent 类
 */
export class DeepAgent {
  private llm: ChatOpenAI;
  private maxSteps: number;
  private confidenceThreshold: number;
  private skillRegistry: SkillRegistry;
  private onProgress?: (event: ProgressEvent) => void;

  constructor(config: DeepAgentConfig) {
    this.llm = config.llm;
    this.maxSteps = config.maxSteps ?? 10;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.6;
    this.onProgress = config.onProgress;
    this.skillRegistry = new SkillRegistry();
  }

  /**
   * 注册 Skill
   */
  registerSkill(skill: ISkill): void {
    this.skillRegistry.register(skill);
  }

  /**
   * 批量注册 Skills
   */
  registerSkills(skills: ISkill[]): void {
    for (const skill of skills) {
      this.registerSkill(skill);
    }
  }

  /**
   * 获取已注册的 Skills
   */
  getRegisteredSkills(): string[] {
    return this.skillRegistry.getAllNames();
  }

  /**
   * 主执行入口
   */
  async execute(goal: string, entity: string): Promise<DeepAgentResult> {
    const startTime = Date.now();
    logger.info('DeepAgent starting execution', { goal, entity, maxSteps: this.maxSteps });

    try {
      // 初始化状态
      const state = this.initializeState(goal, entity);
      
      this.emitProgress({
        type: 'thinking',
        step: 0,
        message: '开始分析任务...',
      });

      // 执行循环
      while (state.step < this.maxSteps) {
        logger.info(`Step ${state.step + 1}/${this.maxSteps}`, {
          confidence: state.context.confidence,
          gaps: state.context.gaps,
        });

        // 1. 观察当前状态
        const observationContext = this.buildObservationContext(state);
        
        this.emitProgress({
          type: 'thinking',
          step: state.step,
          message: `正在评估当前状态 (置信度: ${(state.context.confidence * 100).toFixed(0)}%)...`,
        });

        // 2. LLM 推理决策
        const decision = await this.think(observationContext);
        
        // 记录思考
        state.thoughts.push({
          step: state.step,
          content: decision.thought,
          type: 'decision',
          timestamp: Date.now(),
        });

        logger.info('Decision made', {
          decision: decision.decision,
          nextSkill: decision.nextSkill,
          reason: decision.reason,
        });

        // 3. 根据决策行动
        if (decision.decision === 'finalize') {
          this.emitProgress({
            type: 'complete',
            step: state.step,
            message: '信息充足，生成最终报告...',
          });
          
          const result = await this.finalize(state, startTime);
          logger.info('DeepAgent execution completed', { totalSteps: state.step });
          return result;
        }

        if (decision.decision === 'error') {
          state.status = 'error';
          state.error = decision.reason || '决策错误';
          
          this.emitProgress({
            type: 'error',
            step: state.step,
            message: `执行出错: ${state.error}`,
          });
          
          return this.createErrorResult(state, startTime);
        }

        if (decision.decision === 'continue' && decision.nextSkill) {
          // 检查是否已使用过该 Skill
          const skillUseCount = state.context.skillsUsed.filter(s => s === decision.nextSkill).length;
          
          if (skillUseCount >= 2) {
            logger.warn(`Skill ${decision.nextSkill} already used ${skillUseCount} times, forcing finalize`);
            
            state.thoughts.push({
              step: state.step,
              content: `${decision.nextSkill} 已使用 ${skillUseCount} 次，为避免循环强制结束`,
              type: 'decision',
              timestamp: Date.now(),
            });
            
            const result = await this.finalize(state, startTime);
            return result;
          }

          // 执行 Skill
          await this.executeSkill(state, decision.nextSkill, decision.skillInput);
        }

        state.step++;
      }

      // 达到最大步数，强制结束
      logger.info('Max steps reached, finalizing');
      
      state.thoughts.push({
        step: state.step,
        content: `达到最大步数限制 (${this.maxSteps})，强制结束`,
        type: 'decision',
        timestamp: Date.now(),
      });

      this.emitProgress({
        type: 'complete',
        step: state.step,
        message: '达到最大步数，生成最终报告...',
      });

      return await this.finalize(state, startTime, '达到最大步数限制');
      
    } catch (error) {
      logger.error('DeepAgent execution failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * 初始化状态
   */
  private initializeState(goal: string, entity: string): DeepAgentState {
    return {
      goal,
      entity,
      thoughts: [],
      actions: [],
      observations: [],
      context: {
        collectedData: {},
        confidence: 0,
        gaps: [],
        skillsUsed: [],
      },
      step: 0,
      maxSteps: this.maxSteps,
      status: 'planning',
    };
  }

  /**
   * 构建观察上下文
   */
  private buildObservationContext(state: DeepAgentState): ObservationContext {
    const lastObservation = state.observations[state.observations.length - 1]?.output;
    const dbSchemaSummary = formatDbSchemaForPrompt(dbAgentSchema);
    const dbTaskList = dbAgentSchema.tasks.map(
      (task) => `${task.id} (${task.tables.join(", ")}): ${task.description}`,
    );
    
    return {
      step: state.step,
      goal: state.goal,
      entity: state.entity,
      actionsCount: state.actions.length,
      confidence: state.context.confidence,
      gaps: state.context.gaps,
      lastObservation,
      availableSkills: this.skillRegistry.getAllNames(),
      dbSchemaSummary,
      dbTaskList,
    };
  }

  /**
   * LLM 推理决策
   */
  private async think(context: ObservationContext): Promise<Decision> {
    const prompt = buildObservationPrompt(context);
    
    try {
      const response = await this.llm.invoke(prompt);
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      const parsed = parseDecision(content);
      
      if (parsed && parsed.decision) {
        return {
          thought: parsed.thought || 'No thought provided',
          analysis: parsed.analysis,
          decision: parsed.decision,
          nextSkill: parsed.nextSkill || null,
          skillInput: parsed.skillInput,
          reason: parsed.reason || 'No reason provided',
        };
      }
      
      // 解析失败，使用默认决策
      logger.warn('Failed to parse decision, using default');
      return this.getDefaultDecision(context);
      
    } catch (error) {
      logger.error('LLM decision failed', { error: String(error) });
      return this.getDefaultDecision(context);
    }
  }

  /**
   * 获取默认决策
   */
  private getDefaultDecision(context: ObservationContext): Decision {
    const hasData = context.actionsCount > 0;
    const confidence = context.confidence;
    
    if (!hasData) {
      return {
        thought: '首次执行，需要收集基础数据',
        decision: 'continue',
        nextSkill: 'fund-deep-search',
        skillInput: { entity: context.entity },
        reason: '没有数据，必须先搜索',
      };
    }
    
    if (confidence < this.confidenceThreshold) {
      return {
        thought: '置信度不足，需要补充数据',
        decision: 'continue',
        nextSkill: 'fund-deep-search',
        skillInput: { entity: context.entity, previousGaps: context.gaps },
        reason: `置信度 ${(confidence * 100).toFixed(0)}% 低于阈值 ${(this.confidenceThreshold * 100).toFixed(0)}%`,
      };
    }
    
    return {
      thought: '数据充足，可以进入分析',
      decision: 'finalize',
      nextSkill: null,
      reason: `置信度 ${(confidence * 100).toFixed(0)}% 达到要求`,
    };
  }

  /**
   * 执行 Skill
   */
  private async executeSkill(
    state: DeepAgentState,
    skillName: string,
    skillInput: any
  ): Promise<void> {
    const skill = this.skillRegistry.get(skillName);
    
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    this.emitProgress({
      type: 'acting',
      step: state.step,
      message: `执行 ${skillName}...`,
      data: { skillName, input: skillInput },
    });

    // 记录行动
    const action: Action = {
      step: state.step,
      skillName,
      input: skillInput,
      timestamp: Date.now(),
    };
    state.actions.push(action);
    state.context.skillsUsed.push(skillName);
    state.status = 'acting';

    if (skillName === 'fund-deep-search') {
      const searchLabel =
        skillInput?.entity || skillInput?.query || skillInput?.name || '未知搜索';
      this.emitProgress({
        type: 'searching',
        step: state.step,
        message: `正在搜索: ${searchLabel}`,
        data: { currentQuery: searchLabel },
      });
    }

    if (skillName === 'db-agent') {
      this.emitProgress({
        type: 'db_query',
        step: state.step,
        message: `数据库查询: ${skillInput?.task ?? '未知任务'}`,
        data: {
          task: skillInput?.task,
          params: skillInput?.params,
        },
      });
    }

    try {
      // 执行 Skill
      const output = await skill.execute(skillInput);

      this.emitProgress({
        type: 'observing',
        step: state.step,
        message: `${skillName} 执行完成 (置信度: ${(output.confidence * 100).toFixed(0)}%)`,
        data: { skillName, output },
      });

      if (skillName === 'fund-deep-search') {
        const searchResults = output.data?.searchResults || [];
        const searchLabel =
          skillInput?.entity || skillInput?.query || skillInput?.name || 'search';
        this.emitProgress({
          type: 'search_result',
          step: state.step,
          message: `网页搜索完成: ${searchResults.length} 条`,
          data: {
            query: searchLabel,
            results: searchResults,
          },
        });
        this.emitProgress({
          type: 'search_complete',
          step: state.step,
          message: `搜索阶段完成: ${searchLabel}`,
          data: { query: searchLabel },
        });
      }

      if (skillName === 'db-agent') {
        this.emitProgress({
          type: 'db_result',
          step: state.step,
          message: `数据库结果: ${skillInput?.task ?? '查询'}`,
          data: {
            task: skillInput?.task,
            results: output.data,
          },
        });
      }

      // 记录观察
      const observation: Observation = {
        step: state.step,
        skillName,
        output,
        timestamp: Date.now(),
      };
      state.observations.push(observation);

      // 更新上下文
      this.updateContext(state, skillName, output);
      state.status = 'observing';
      
    } catch (error) {
      logger.error(`Skill ${skillName} execution failed`, { error: String(error) });
      
      // 记录失败的观察
      const failedObservation: Observation = {
        step: state.step,
        skillName,
        output: {
          success: false,
          error: String(error),
          confidence: 0,
          completeness: 0,
          gaps: ['Skill 执行失败'],
        },
        timestamp: Date.now(),
      };
      state.observations.push(failedObservation);
    }
  }

  /**
   * 更新上下文
   */
  private updateContext(state: DeepAgentState, skillName: string, output: SkillOutput): void {
    // 存储数据
    if (output.success && output.data) {
      state.context.collectedData[skillName] = output.data;
    }

    // 更新缺口
    if (output.gaps.length > 0) {
      // 合并缺口，去重
      const newGaps = output.gaps.filter(gap => !state.context.gaps.includes(gap));
      state.context.gaps.push(...newGaps);
    }

    // 更新整体置信度 (取所有观察的平均)
    if (state.observations.length > 0) {
      const totalConfidence = state.observations.reduce((sum, obs) => 
        sum + obs.output.confidence, 0
      );
      state.context.confidence = totalConfidence / state.observations.length;
    }
  }

  /**
   * 生成最终结果
   */
  private async finalize(
    state: DeepAgentState,
    startTime: number,
    note?: string
  ): Promise<DeepAgentResult> {
    state.status = 'complete';

    // 构建最终数据
    const finalData = await this.buildFinalData(state);

    return {
      success: true,
      data: finalData,
      thoughts: state.thoughts,
      actions: state.actions,
      observations: state.observations,
      skillsUsed: [...new Set(state.context.skillsUsed)],
      totalSteps: state.step,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 构建最终数据
   */
  private async buildFinalData(state: DeepAgentState): Promise<any> {
    // 如果有 debate 数据，直接返回
    if (state.context.collectedData['fund-debate']) {
      return state.context.collectedData['fund-debate'];
    }

    // 否则基于搜索结果生成简化报告
    const searchData = state.context.collectedData['fund-deep-search'];
    
    if (!searchData) {
      return {
        error: '没有收集到足够数据',
        observations: state.observations.map(o => ({
          skill: o.skillName,
          success: o.output.success,
          error: o.output.error,
        })),
      };
    }

    return searchData;
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(state: DeepAgentState, startTime: number): DeepAgentResult {
    return {
      success: false,
      data: null,
      thoughts: state.thoughts,
      actions: state.actions,
      observations: state.observations,
      skillsUsed: [...new Set(state.context.skillsUsed)],
      totalSteps: state.step,
      durationMs: Date.now() - startTime,
      error: state.error,
    };
  }

  /**
   * 发送进度事件
   */
  private emitProgress(event: ProgressEvent): void {
    if (this.onProgress) {
      this.onProgress(event);
    }
  }
}
