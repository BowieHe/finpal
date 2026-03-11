import { GraphState } from '../state';
import { getLLMInstance, withRetry } from '../../llm/client';
import { extractJSONFromText } from '../nodes';
import { createLogger } from '../../logger';
import { ExecutionPlan } from '../../agents/types';

const logger = createLogger('IntentPlanner');

function buildIntentPrompt(question: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  return `你是经验丰富的 CIO（首席投资官）。
当前日期：${dateStr}

用户提出了一个金融/理财相关的问题，你需要分析意图，并将其拆解为底层 Agent 可以执行的独立任务。

底部提供了可用的 Agent 工具及其输入规范。
请给出一个执行计划 JSON，严格按照以下要求：

{
  "requiresDebate": boolean, // 是否必须触发双人格辩论分析团队？若只是查查净值、问个客观问题选 false；若是对比、深度分析、建议选 true
  "tasks": [
    {
      "agent": "db-agent" | "web-agent" | "quant-agent",
      "task": "具体的 task 名称",
      "params": { 
        // 按照 Agent 要求填写的参数
      },
      "priority": number, // 优先级 1最高，同优先级并行执行
      "canSkip": boolean  // 如果这个子任务失败，是否允许忽略它继续走后续流程？
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

3. Quant-Agent (量化计算，目前其参数由DB-Agent或Web-Agent查出后传入，所以【在 CIO 派发阶段通常不需要手动派发 quant-agent，除非特殊独立计算】)

=== 要求 ===
- 若用户问"今天大盘如何"，只需派发 1 个 Web-Agent (market_news)，requiresDebate: false。
- 若用户问"总结持仓并对比 A 和 B"，需派发 1个 DB-Agent(portfolio_summary) + 2个 Web-Agent(fund_info) 并行，requiresDebate: true。
- 从用户提问中提取6位数的基金代码，不要瞎编代码。

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

  const llm = getLLMInstance();
  const prompt = buildIntentPrompt(state.question);

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
