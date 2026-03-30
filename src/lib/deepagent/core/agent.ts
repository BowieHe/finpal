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
        eventDetail: {
          eventType: 'thinking',
          label: '分析目标',
          detail: `分析对象: ${entity}`,
          metadata: { goal, entity }
        }
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
          eventDetail: {
            eventType: 'thinking',
            label: '状态评估',
            detail: `置信度: ${(state.context.confidence * 100).toFixed(0)}%, 缺口: ${state.context.gaps.length} 个`,
            expandable: state.context.gaps.length > 0,
            content: state.context.gaps,
            metadata: {
              confidence: state.context.confidence,
              gapCount: state.context.gaps.length,
              gaps: state.context.gaps,
              step: state.step
            }
          }
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

        this.emitProgress({
          type: 'thinking',
          step: state.step,
          message: decision.reason,
          eventDetail: {
            eventType: 'thinking',
            label: '决策',
            detail: decision.reason,
            expandable: true,
            content: {
              thought: decision.thought,
              analysis: decision.analysis,
              nextSkill: decision.nextSkill,
              skillInput: decision.skillInput
            },
            metadata: {
              decision: decision.decision,
              nextSkill: decision.nextSkill
            }
          }
        });

        // 3. 根据决策行动
        if (decision.decision === 'finalize') {
          this.emitProgress({
            type: 'complete',
            step: state.step,
            message: '信息充足，生成最终报告...',
            eventDetail: {
              eventType: 'complete',
              label: '生成报告',
              detail: `基于 ${state.observations.length} 次观察生成最终分析`,
              metadata: {
                observations: state.observations.length,
                confidence: state.context.confidence,
                steps: state.step
              }
            }
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
            eventDetail: {
              eventType: 'search',
              label: '执行错误',
              detail: state.error,
              metadata: { error: state.error }
            }
          });

          return this.createErrorResult(state, startTime);
        }

        if (decision.decision === 'continue' && decision.nextSkill) {
          // 检查是否重复调用完全相同的 Skill + Task
          const skillTaskKey = `${decision.nextSkill}:${JSON.stringify(decision.skillInput || {})}`;
          const skillTaskUseCount = state.actions.filter(
            a => `${a.skillName}:${JSON.stringify(a.input || {})}` === skillTaskKey
          ).length;

          // 只有完全相同的 (skill + input) 调用超过 1 次才阻止
          if (skillTaskUseCount >= 1) {
            logger.warn(`Same skill+task ${decision.nextSkill} already executed, forcing finalize`);

            state.thoughts.push({
              step: state.step,
              content: `${decision.nextSkill} 已经执行过相同任务，为避免重复强制结束`,
              type: 'decision',
              timestamp: Date.now(),
            });

            this.emitProgress({
              type: 'thinking',
              step: state.step,
              message: `${decision.nextSkill} 已执行过，生成最终报告...`,
              eventDetail: {
                eventType: 'thinking',
                label: '避免重复',
                detail: `相同任务已执行，进入总结阶段`,
                metadata: { skill: decision.nextSkill }
              }
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
        eventDetail: {
          eventType: 'complete',
          label: '强制结束',
          detail: `达到最大步数限制 (${this.maxSteps})`,
          metadata: { maxSteps: this.maxSteps }
        }
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
      collectedData: state.context.collectedData,
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
    const searchData = context.collectedData['fund-deep-search'];
    const dbData = context.collectedData['db-agent'];
    const hasResearchData = !!searchData || !!dbData;
    
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

    if (hasResearchData) {
      return {
        thought: '已有足够研究材料，默认进入多空分析',
        decision: 'continue',
        nextSkill: 'fund-debate',
        skillInput: {
          entity: context.entity,
          researchData: searchData || {
            fundInfo: {
              name: context.entity,
            },
            news: [],
            risks: [],
            sources: [],
            searchQueries: [],
          },
        },
        reason: `LLM 决策失败，使用默认策略：置信度 ${(confidence * 100).toFixed(0)}% 已达阈值，先进入多空辩论而不是直接结束`,
      };
    }

    return {
      thought: '已有部分数据，但还缺少可用于辩论的研究包',
      decision: 'finalize',
      nextSkill: null,
      reason: `默认结束：置信度 ${(confidence * 100).toFixed(0)}% 达到要求，但暂无完整研究包`,
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

    // 准备输入（添加 previousGaps 用于优化）
    const enrichedInput = {
      ...skillInput,
      entity: skillInput?.entity || state.entity,
      previousGaps: state.context.gaps,
      isRetry: state.context.skillsUsed.filter(s => s === skillName).length > 0,
    };

    this.emitProgress({
      type: 'acting',
      step: state.step,
      message: `执行 ${skillName}...`,
      data: { skillName, input: enrichedInput },
      eventDetail: {
        eventType: 'skill_call',
        label: '执行 Skill',
        detail: skillName,
        metadata: {
          skillName,
          hasPreviousGaps: state.context.gaps.length > 0,
          isRetry: enrichedInput.isRetry
        }
      }
    });

    // 记录行动
    const action: Action = {
      step: state.step,
      skillName,
      input: enrichedInput,
      timestamp: Date.now(),
    };
    state.actions.push(action);
    state.context.skillsUsed.push(skillName);
    state.status = 'acting';

    try {
      // 创建 progress handler 来透传 skill 的事件
      const skillProgressHandler = (event: ProgressEvent) => {
        // 透传 eventDetail 到上层
        this.emitProgress({
          ...event,
          step: state.step,
        });
      };

      // 执行 Skill（传递 progress handler）
      const output = await skill.execute(enrichedInput, skillProgressHandler);

      this.emitProgress({
        type: 'observing',
        step: state.step,
        message: `${skillName} 执行完成 (置信度: ${(output.confidence * 100).toFixed(0)}%)`,
        data: { skillName, output },
        eventDetail: {
          eventType: 'analyze',
          label: 'Skill 完成',
          detail: `${skillName} · 置信度 ${(output.confidence * 100).toFixed(0)}%`,
          metadata: {
            skillName,
            confidence: output.confidence,
            gaps: output.gaps
          }
        }
      });

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

      this.emitProgress({
        type: 'error',
        step: state.step,
        message: `${skillName} 执行失败: ${String(error)}`,
        eventDetail: {
          eventType: 'search',
          label: 'Skill 失败',
          detail: String(error),
          metadata: { skillName, error: String(error) }
        }
      });

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

    // 收集所有数据
    const dbData = state.context.collectedData['db-agent'];
    const searchData = state.context.collectedData['fund-deep-search'];

    // 如果没有数据，返回错误
    if (!dbData && !searchData) {
      return {
        error: '没有收集到足够数据',
        observations: state.observations.map(o => ({
          skill: o.skillName,
          success: o.output.success,
          error: o.output.error,
        })),
      };
    }

    // 使用 LLM 基于收集的数据生成总结
    try {
      const summary = await this.generateSummary(state.goal, dbData, searchData, state.thoughts);
      return {
        summary,
        dbData,
        searchData,
        sources: searchData?.sources || [],
      };
    } catch (error) {
      logger.error('Failed to generate summary, returning raw data', { error: String(error) });
      return {
        summary: '基于收集的数据，我为您整理以下信息：',
        dbData,
        searchData,
        sources: searchData?.sources || [],
      };
    }
  }

  /**
   * 使用 LLM 生成总结
   */
  private async generateSummary(
    goal: string,
    dbData: any,
    searchData: any,
    thoughts: Thought[]
  ): Promise<string> {
    const prompt = `基于以下收集的信息，请为用户问题生成一个简洁但有信息量的回答。

## 用户问题
${goal}

## 已收集的数据

### 持仓数据（来自数据库）
${dbData ? JSON.stringify(dbData, null, 2) : '无持仓数据'}

### 搜索数据（来自 web）
${searchData ? JSON.stringify({
  fundInfo: searchData.fundInfo,
  news: searchData.news?.slice(0, 3),
  risks: searchData.risks?.slice(0, 5),
}, null, 2) : '无搜索数据'}

## 分析过程
${thoughts.map(t => `- ${t.type}: ${t.content.substring(0, 200)}`).join('\n')}

## 输出要求

请生成一个结构化的回答，包含：
1. 简要总结当前情况
2. 关键发现（基于收集的数据）
3. 给用户的相关建议

回答要简洁明了，控制在 300-500 字。直接写回答内容，不要包含 "以下是回答" 这样的前缀。`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
      return content.trim();
    } catch (error) {
      logger.error('LLM summary generation failed', { error: String(error) });
      throw error;
    }
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
