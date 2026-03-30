import { DBAgentTask } from "./types";

export interface DbAgentTableSchema {
  name: string;
  description: string;
  columns: string[];
}

export interface DbAgentTaskSchema {
  id: DBAgentTask;
  description: string;
  tables: string[];
  example: string;
}

export interface DbAgentSchema {
  purpose: string;
  tables: DbAgentTableSchema[];
  tasks: DbAgentTaskSchema[];
}

export const dbAgentSchema: DbAgentSchema = {
  purpose:
    "内置数据库保存用户持仓、组合、净值和风险指标，用于回答‘我的持仓’类问题。",
  tables: [
    {
      name: "user_holdings",
      description:
        "记录用户每只基金的持仓份额、成本、买入时间，以 fund_code / fund_name 为主键。",
      columns: [
        "fund_code",
        "fund_name",
        "shares",
        "cost_price",
        "buy_date",
        "created_at",
      ],
    },
    {
      name: "fund_nav",
      description:
        "存储基金的历史净值，用于计算收益、当日涨跌和 max drawdown。",
      columns: ["fund_code", "nav_date", "unit_nav", "accum_nav", "daily_return"],
    },
    {
      name: "fund_basic",
      description:
        "基金基础档案（代码、名称、分类、经理、公司），用于快速定位基金属性。",
      columns: ["code", "name", "category", "manager", "company", "established_date"],
    },
    {
      name: "holding_transactions",
      description:
        "记录每笔购买/赎回交易，可连带计算换手、洗仓等行为。",
      columns: ["holding_id", "type", "date", "shares", "price", "amount"],
    },
  ],
  tasks: [
    {
      id: "portfolio_summary",
      description:
        "总结全部持仓的组合价值、盈亏、持仓比重，与最新净值对比。",
      tables: ["user_holdings", "fund_nav"],
      example:
        "汇总所有 user_holdings，关联 latest fund_nav 计算 total_value/total_profit/avg_daily 返回 navDate。",
    },
    {
      id: "holding_detail",
      description:
        "针对特定基金代码，返回当前持仓明细、历史净值趋势和交易记录。",
      tables: ["user_holdings", "fund_nav", "holding_transactions"],
      example:
        "查询 user_holdings + fund_nav 获取历史曲线，辅助结构化的 daily return。",
    },
    {
      id: "compare_funds",
      description:
        "对比多只基金的持仓、收益、风险，让你知道相对力度。",
      tables: ["user_holdings", "fund_nav", "fund_basic"],
      example:
        "拉出多个 fund_basic + user_holdings + recent fund_nav，然后计算 sharpe、volatility 等指标。",
    },
    {
      id: "risk_metrics",
      description:
        "基于持仓和历史净值计算夏普、最大回撤、波动率等风险指标。",
      tables: ["fund_nav"],
      example:
        "从 fund_nav 读取连续价格，按 quant formulas 计算 sharpe/max drawdown/volatility 等。",
    },
  ],
};

export const formatDbSchemaForPrompt = (schema: DbAgentSchema): string => {
  const tableLines = schema.tables
    .map(
      (table) =>
        `- ${table.name}: ${table.description} (columns: ${table.columns.join(
          ", ",
        )})`,
    )
    .join("\n");

  const taskLines = schema.tasks
    .map(
      (task) =>
        `- ${task.id}: ${task.description} (tables: ${task.tables.join(
          ", ",
        )}) e.g., ${task.example}`,
    )
    .join("\n");

  return `DB Agent schema (${schema.purpose})\nTables:\n${tableLines}\nTasks:\n${taskLines}`;
};
