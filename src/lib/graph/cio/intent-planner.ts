import { GraphState } from '../state';
import { getLLMInstance, withRetry } from '../../llm/client';
import { extractJSONFromText } from '../nodes';
import { createLogger } from '../../logger';
import { ExecutionPlan } from '../../agents/types';

const logger = createLogger('IntentPlanner');

function buildIntentPrompt(question: string, collectedData: Record<string, any> = {}, allFindings: any[] = []): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const dataContext = Object.keys(collectedData).length > 0
    ? `\n=== 已获信息 (Context) ===\n${JSON.stringify(collectedData, null, 2)}\n`
    : '';

  const findingsContext = allFindings.length > 0
    ? `\n=== 深度研究发现 (Deep Research Findings) ===\n${allFindings.map(f => `查询: ${f.query}\n内容: ${f.content.substring(0, 500)}...\n来源: ${f.sources.join(', ')}`).join('\n---\n')}\n`
    : '';

  return `你是经验丰富的 CIO（首席投资官）。
当前日期：${dateStr}
${dataContext}
用户提出了一个金融/理财相关的问题，你需要分析意图，并判断当前已获信息是否足以支持深入分析或直接回答。

### 核心规划原则（必须严格遵守）：
1. **数据驱动，禁止盲猜**：
   - 优先核实真实持仓：若涉及“我的持仓”且数据未到位，必须先派发 DB-Agent(portfolio_summary)。
   - **知识差距分析**：对比用户问题与当前已获信息，识别缺失的关键事实。

2. **多维搜索与深读**：
   - **广度优先**：首轮应生成多维度搜索任务。
   - **深度优先**：若已搜到关键网页或公告，应派发 Web-Agent(fetch_page) 进行深读，而非仅看摘要。

2. **顺序依赖管理**：
   - 如果用户的问题涉及“我的持仓”，且当前已获信息为空：
     - 第一轮：仅派发 DB-Agent(portfolio_summary)。
     - 第二轮（当拿到持仓数据后）：根据持仓里的 fundCode 派发 Web-Agent 或其他分析任务。
   - 如果用户同时问了“大盘行情”和“我的持仓”，你可以并行派发 Web-Agent(market_news) 和 DB-Agent(portfolio_summary)。

3. **结束条件**：
   - 只有当你认为当前信息足以支撑回答用户最核心的问题时，才将 "tasks" 置为空数组 []。
   - 指明 "requiresDebate"：涉及投资建议、对比分析、前景展望等主观判断时设为 true。

请给出一个执行计划 JSON，严格按照以下要求：

{
  "requiresDebate": boolean,
  "tasks": [
    {
      "agent": "db-agent" | "web-agent" | "quant-agent",
      "task": "具体的 task 名称",
      "params": { 
        // 按照 Agent 要求填写的参数
      },
      "priority": number, // 优先级 1最高，同优先级并行执行
      "canSkip": boolean  // 重要：对于 Web-Agent 搜索任务，除非是核心前置逻辑，否则建议设为 true，以防止网络波动导致整个流程中断。
    }
  ]
}

=== 可用 Agent 规范 ===
1. DB-Agent (仅查数据库本地持仓，不联网)
- task: "portfolio_summary", params: {} 
- task: "holding_detail", params: { "fundCode": "基金代码" }
- task: "compare_funds", params: { "fundCodes": ["代码1", "代码2"] }
- task: "risk_metrics", params: { "fundCode": "代码", "period": "ytd" | "1y" | "3y" }

2. Web-Agent (仅联网查外部新闻和最新净值规模，不查持仓)
- task: "fund_info", params: { "fundCode": "代码", "query": "" }
- task: "market_news", params: { "query": "搜索词" }
- task: "manager_info", params: { "fundCode": "代码", "query": "搜索词" }
- task: "fetch_page", params: { "url": "网页链接", "fundCode": "代码(可选)" }

3. Quant-Agent (通常由系统在后续阶段自动触发，CIO 阶段除非极其特殊的计算否则不发)

=== 限制 ===
- 提取6位数字基金代码，不瞎编。
- 始终输出 JSON 字符串，不包含 Markdown 额外包裹。

用户问题：${question}

请仅输出 JSON 字符串，不包含任何 Markdown 额外包裹。`;
}

export const intentPlannerNode = async (state: GraphState): Promise<Partial<GraphState>> => {
  logger.info('Starting intent planner', { question: state.question });

  if (state.progressCallback) {
    state.progressCallback({
      type: 'cio_planning',
      data: { message: 'CIO 正在拆解意图，生成任务计划...' }
    });
  }

  const llm = await getLLMInstance();
  const collectedKeys = Object.keys(state.collectedData || {});
  logger.info('Planning iteration', { 
    collectedKeys, 
    iterationCount: state.round 
  });
  
  const prompt = buildIntentPrompt(state.question, state.collectedData, state.allFindings);
  // logger.debug('Generated Intent Prompt', { prompt }); // Sensitive but useful for deep debug


  try {
    const response = await withRetry(() => llm.invoke(prompt), 2, 1000);
    const contentStr = typeof response.content === 'string' ? response.content : String(response.content);

    // Parse using imported helper
    const parsed = extractJSONFromText(contentStr);

    if (!parsed || !Array.isArray(parsed.tasks)) {
      throw new Error('Failed to parse a valid plan from CIO output');
    }

    const plan = parsed as unknown as ExecutionPlan;

    logger.info('Plan generated successfully', {
      requiresDebate: plan.requiresDebate,
      taskCount: plan.tasks.length
    });

    if (state.progressCallback) {
      state.progressCallback({
        type: 'cio_planning',
        data: { message: `CIO 规划完成，共需拆派 ${plan.tasks.length} 项子任务。`, results: [plan] }
      });
    }

    return { plan };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('CIO planning failed', { error: errorMessage });

    // Fallback simple plan
    return {
      plan: {
        requiresDebate: false,
        tasks: [
          {
            agent: 'web-agent',
            task: 'market_news',
            params: { query: state.question },
            priority: 1,
            canSkip: false
          }
        ]
      },
      errors: [`CIO 意图识别降级: ${errorMessage}`]
    };
  }
};
