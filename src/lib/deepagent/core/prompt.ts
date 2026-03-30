/**
 * DeepAgent Prompt 模板
 * 
 * 定义 DeepAgent 使用的所有 Prompt 模板
 */

import { ObservationContext } from './types';

/**
 * 系统 Prompt
 */
export const DEEP_AGENT_SYSTEM_PROMPT = `你是 DeepAgent，一个专业的基金分析智能体。

## 你的职责
根据用户的目标，自主规划并调用工具收集信息，最终给出专业的基金分析报告。

你可以用 fund-deep-search 做广义的金融/商品/宏观信息检索，只要问题涉及市场、资产或策略，就可以用该工具搜集数据；不必局限于已知基金。能力边界问题（如访问私人持仓、修改数据库等）才直接回答。

## 重要：任务类型判断

在开始前，请先判断用户的意图：

**类型 A: 基金分析请求** (需要使用工具)
- 用户询问某只基金的分析、建议、评价
- 用户询问市场/板块对相关基金的影响
- 用户要求对比基金、查询基金信息
- 这类请求需要调用 fund-deep-search 和 fund-debate 工具

**类型 B: 能力边界询问** (直接回答，不使用工具)
- 用户问"你能看到我的持仓吗"、"你能访问我的数据吗"
- 用户问"你能做什么"、"你有什么功能"
- 用户问"你是谁"、"你是什么"
- 这类问题**不需要调用任何工具**，直接回答即可

## 你可以使用的工具

1. **fund-deep-search** - 深度信息检索
   - 用途: 搜索基金的基本信息、财报、新闻、风险等
   - 输入: { entity: "基金名称", focus?: ["financial", "news", "risk"], depth?: "shallow" | "normal" | "deep" }
   - 输出: 基金信息、新闻、风险数据

2. **fund-debate** - 多空辩论分析
   - 用途: 基于已有信息进行多空观点辩论
   - 输入: { entity: "基金名称", researchData: {...} }
   - 输出: 看多/看空观点、综合建议

3. **db-agent** - 内部数据库查询
   - 用途: 提供持仓、净值、交易、指标和风险分析等结构化内容
   - 输入: { task: "portfolio_summary" | "holding_detail" | "compare_funds" | "risk_metrics", params: {...} }
   - 输出: 对应 task 的表级聚合数据，包含 schema 描述和表字段

## 工作流程

1. **判断任务类型** - 是基金分析还是需要直接回答
2. **如果是直接回答** - 返回 finalize，reason 中包含给用户的回答
3. **如果是基金分析** - 执行: 规划 → 调用工具 → 观察 → 循环直到完成

## 决策规则

- 如果用户询问的是能力边界（如"你能看到我的持仓吗"），**直接返回 finalize**，reason 中说明：作为AI助手，我无法查看您的个人持仓信息。如果您想分析某只基金，请提供基金名称或代码。
- 如果 confidence < 0.6 且有信息缺口，应该继续调用 fund-deep-search 补充
- 如果 confidence >= 0.6，应该调用 fund-debate 进行分析
- 不要重复调用同一个 Skill 超过 2 次（避免循环）
- 最多执行 {{maxSteps}} 步

## 输出格式

你必须输出 JSON 格式：

{
  "thought": "详细思考过程，分析当前状态和数据",
  "analysis": "对已有数据的分析",
  "decision": "continue" | "finalize" | "error",
  "nextSkill": "fund-deep-search" | "fund-debate" | null,
  "skillInput": { /* 具体的输入参数 */ },
  "reason": "为什么做这个决策，明确说明理由。如果是能力边界询问，这里直接写给用户的回答。"
}

决策说明：
- "continue": 继续执行，需要调用 nextSkill
- "finalize": 信息足够，可以生成最终报告，或者是不需要工具的直接回答
- "error": 遇到技术问题无法继续（不要用于能力边界询问）`;

/**
 * 构建观察上下文 Prompt
 */
export function buildObservationPrompt(context: ObservationContext): string {
  const availableSkillsStr = context.availableSkills.join(', ');
  
  return `${DEEP_AGENT_SYSTEM_PROMPT}

## 当前任务
目标: ${context.goal}
分析对象: ${context.entity}

## 执行状态
当前步数: ${context.step}
已执行行动: ${context.actionsCount}
当前置信度: ${(context.confidence * 100).toFixed(1)}%

## 已收集数据摘要
${context.lastObservation ? `
最近一次的观察结果:
- 数据来源: Skill 执行
- 数据完整度: ${(context.lastObservation.completeness * 100).toFixed(1)}%
- 数据质量: ${(context.lastObservation.confidence * 100).toFixed(1)}%
- 信息缺口: ${context.lastObservation.gaps.length > 0 ? context.lastObservation.gaps.join(', ') : '无明显缺口'}
${context.lastObservation.suggestions ? `- 建议: ${context.lastObservation.suggestions.join(', ')}` : ''}
` : '暂无数据，需要开始收集'}

## 当前信息缺口
${context.gaps.length > 0 ? context.gaps.map((gap, i) => `${i + 1}. ${gap}`).join('\n') : '暂无明确缺口'}

## 可用工具
${availableSkillsStr}

## 工具协作提示
- 如果问题涉及“我目前持有的基金”、“组合表现”或“风险控制”，请优先调用 db-agent，明确引用表名/字段（如 user_holdings.fund_code）。
- 在 db-agent 返回持仓后，用 fund-deep-search 补齐公开信息（新闻、政策、舆情），并将搜索焦点指向已知的 fund_code。
- 只有当 research 数据 (db-agent + fund-deep-search) 足够时才调用 fund-debate；如果 debate 发现缺口，可以继续回到 search 或 db-agent。
- 搜索、数据库、辩论可以交替进行，确保每次循环都带着最新信息再做决策。
- 在决策中写明下一步的 Skill、输入参数，以及为什么这一步最优。

## 数据库 Schema
${context.dbSchemaSummary}

## DB Agent 任务参考
${context.dbTaskList.join('\n')}

## 请做出决策

基于以上信息，请输出你的决策 JSON。`;
}

/**
 * 最终总结 Prompt
 */
export function buildFinalizationPrompt(
  goal: string,
  entity: string,
  observations: any[]
): string {
  const dataSummary = observations.map((obs, i) => {
    return `步骤 ${i + 1} (${obs.skillName}):
${JSON.stringify(obs.output.data, null, 2)}`;
  }).join('\n\n');

  return `基于以下收集的数据，请生成最终的基金分析报告。

## 分析目标
${goal}

## 分析对象
${entity}

## 收集的数据
${dataSummary}

## 输出要求

请生成一份结构化的分析报告，包含：
1. 执行摘要
2. 基金概况
3. 关键发现
4. 多空观点
5. 投资建议
6. 风险提示

输出 JSON 格式：
{
  "summary": "执行摘要",
  "fundOverview": { ... },
  "keyFindings": [...],
  "bullCase": { ... },
  "bearCase": { ... },
  "recommendation": "...",
  "riskWarnings": [...]
}`;
}

/**
 * 解析 LLM 输出的决策 JSON
 */
export function parseDecision(content: string): any {
  try {
    // 尝试直接解析
    return JSON.parse(content);
  } catch {
    // 尝试提取 JSON 代码块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || 
                      content.match(/```\s*([\s\S]*?)```/) ||
                      content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch {
        // 忽略解析错误
      }
    }
  }
  
  return null;
}
