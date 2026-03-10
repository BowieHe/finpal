# FinPal 基金数据分析功能 PRD

## 1. 项目背景

FinPal 已经实现了基础的基金数据获取和存储功能。现在需要构建一套完整的数据分析体系，帮助用户管理持仓、计算收益、对比基金表现。

## 2. 功能架构

```
┌─────────────────────────────────────────────────────────┐
│                    数据分析层                            │
├─────────────────────────────────────────────────────────┤
│  数据获取 (Python)    │    数据展示 (Next.js + Prisma)   │
│  - 每日净值同步        │    - 持仓管理                    │
│  - 基础数据更新        │    - 收益计算                    │
│                       │    - 对比分析                    │
└─────────────────────────────────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │ PostgreSQL │
                    │  fund_xxx │
                    └───────────┘
```

## 3. 功能需求清单

### 3.1 用户持仓管理

#### 功能描述
用户可以录入自己的基金持仓信息，系统计算实时收益。

#### 数据模型
```typescript
interface UserHolding {
  id: string
  fundCode: string      // 基金代码
  fundName: string      // 基金名称（冗余存储）
  shares: Decimal       // 持有份额
  costPrice: Decimal    // 成本单价
  totalCost: Decimal    // 总成本（计算字段）
  createdAt: DateTime   // 买入日期
  updatedAt: DateTime   // 更新时间
}
```

#### 核心功能
- [ ] **持仓录入**：输入基金代码、份额、成本价
- [ ] **持仓列表**：展示所有持仓及当前市值
- [ ] **持仓编辑**：修改份额、成本价
- [ ] **持仓删除**：删除持仓记录
- [ ] **批量导入**：支持 CSV/Excel 导入

#### 收益计算公式
```
当前市值 = 持有份额 × 最新净值
持仓盈亏 = 当前市值 - 总成本
盈亏率 = (持仓盈亏 / 总成本) × 100%
当日盈亏 = 持有份额 × (今日净值 - 昨日净值)
```

---

### 3.2 持仓收益计算

#### 功能描述
实时计算用户所有持仓的收益情况。

#### 计算维度
- **单只基金收益**：某只基金的详细收益分析
- **整体收益**：所有持仓的汇总统计
- **历史收益**：按日/周/月统计收益变化

#### 展示指标
```typescript
interface HoldingProfit {
  // 基本信息
  fundCode: string
  fundName: string
  shares: Decimal
  costPrice: Decimal
  
  // 当前状态
  currentNav: Decimal      // 最新净值
  currentValue: Decimal    // 当前市值
  
  // 收益计算
  costValue: Decimal       // 成本
  totalProfit: Decimal     // 累计盈亏
  profitRate: Decimal      // 盈亏率（%）
  dailyProfit: Decimal     // 当日盈亏
  
  // 辅助判断
  isProfit: boolean        // 是否盈利
}
```

#### 汇总统计
```typescript
interface PortfolioSummary {
  totalCost: Decimal       // 总投入
  totalValue: Decimal      // 总市值
  totalProfit: Decimal     // 总盈亏
  totalProfitRate: Decimal // 总收益率
  
  // 分类统计
  profitCount: number      // 盈利基金数
  lossCount: number        // 亏损基金数
  
  // 每日更新
  dailyProfit: Decimal     // 今日总盈亏
  dailyProfitRate: Decimal // 今日收益率
}
```

---

### 3.3 基金对比分析

#### 功能描述
支持多只基金的横向对比，帮助用户选择投资标的。

#### 对比维度
- **收益率对比**：不同时间段收益对比
- **风险指标**：波动率、最大回撤
- **稳定性**：夏普比率、收益标准差

#### 对比算法
```typescript
interface FundComparison {
  fundCode: string
  fundName: string
  category: string
  
  // 收益指标
  return1m: Decimal   // 近1月收益
  return3m: Decimal   // 近3月收益
  return6m: Decimal   // 近6月收益
  return1y: Decimal   // 近1年收益
  returnTotal: Decimal // 成立以来收益
  
  // 风险指标
  volatility: Decimal     // 波动率（标准差）
  maxDrawdown: Decimal    // 最大回撤
  sharpeRatio: Decimal    // 夏普比率
  
  // 风险评级
  riskLevel: 'low' | 'medium' | 'high'
}
```

#### SQL 实现（PostgreSQL 视图）
```sql
CREATE VIEW fund_performance_comparison AS
SELECT 
  n.fund_code,
  b.name,
  b.category,
  
  -- 收益率计算
  calculate_return(n.fund_code, 30) as return_1m,
  calculate_return(n.fund_code, 90) as return_3m,
  calculate_return(n.fund_code, 180) as return_6m,
  calculate_return(n.fund_code, 365) as return_1y,
  
  -- 风险指标
  STDDEV(n.daily_return) as volatility,
  MAX(n.unit_nav) / MIN(n.unit_nav) - 1 as max_drawdown
  
FROM fund_nav n
JOIN fund_basic b ON n.fund_code = b.code
GROUP BY n.fund_code, b.name, b.category;
```

---

### 3.4 定投收益模拟

#### 功能描述
模拟定投策略的收益情况，支持多种定投方式。

#### 定投方式
- **定期定额**：每月固定日期投入固定金额
- **智能定投**：根据市场估值调整投入金额
- **不定期定投**：自定义投入时间和金额

#### 计算模型
```typescript
interface定投Simulation {
  fundCode: string
  strategy: 'fixed' | 'smart' | 'custom'
  
  // 投入参数
  monthlyAmount: Decimal   // 每月投入金额
  startDate: Date
  endDate: Date
  
  // 计算结果
  totalInvested: Decimal   // 总投入
  totalShares: Decimal     // 总份额
  currentValue: Decimal    // 当前市值
  totalProfit: Decimal     // 总收益
  profitRate: Decimal      // 收益率
  
  // 明细
  records:定投Record[]     // 每次投入记录
}

interface定投Record {
  date: Date
  amount: Decimal          // 投入金额
  nav: Decimal             // 当日净值
  shares: Decimal          // 获得份额
  cumulativeShares: Decimal // 累计份额
  cumulativeCost: Decimal  // 累计成本
}
```

#### 计算公式
```
每月获得份额 = 投入金额 / 当月净值
总份额 = Σ(每月获得份额)
总投入 = 投入金额 × 月数
当前市值 = 总份额 × 最新净值
定投收益率 = (当前市值 - 总投入) / 总投入 × 100%
```

---

### 3.5 风险分析指标

#### 功能描述
计算基金的风险指标，帮助用户评估投资风险。

#### 核心指标

##### 1. 波动率（Volatility）
```
波动率 = 收益率标准差 × √交易日数
```
- 年化波动率 = 日波动率 × √252
- 衡量基金价格的波动程度

##### 2. 最大回撤（Max Drawdown）
```
最大回撤 = max((峰值 - 谷值) / 峰值)
```
- 从历史高点到低点的最大跌幅
- 衡量最坏情况下的亏损

##### 3. 夏普比率（Sharpe Ratio）
```
夏普比率 = (基金收益率 - 无风险利率) / 波动率
```
- 衡量风险调整后的收益
- >1 表示优秀，>2 表示卓越

##### 4. 贝塔系数（Beta）
```
Beta = 基金收益率与市场收益率的协方差 / 市场收益率方差
```
- 衡量基金相对于市场的波动性
- β>1 表示比市场波动大

#### SQL 实现
```sql
-- 创建风险指标计算函数
CREATE OR REPLACE FUNCTION calculate_risk_metrics(fund_code TEXT)
RETURNS TABLE (
  volatility DECIMAL,
  max_drawdown DECIMAL,
  sharpe_ratio DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH returns AS (
    SELECT 
      daily_return,
      unit_nav,
      MAX(unit_nav) OVER (ORDER BY nav_date) as running_max
    FROM fund_nav
    WHERE fund_nav.fund_code = $1
  )
  SELECT 
    STDDEV(daily_return) * SQRT(252) as volatility,
    MAX((running_max - unit_nav) / running_max) as max_drawdown,
    (AVG(daily_return) * 252 - 0.03) / (STDDEV(daily_return) * SQRT(252)) as sharpe_ratio
  FROM returns;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. 技术实现方案

### 4.1 数据存储

#### 表结构
```sql
-- 用户持仓表
CREATE TABLE user_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_code VARCHAR(10) NOT NULL REFERENCES fund_basic(code),
  fund_name VARCHAR(100) NOT NULL,
  shares DECIMAL(15, 4) NOT NULL,
  cost_price DECIMAL(10, 4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 持仓收益历史（每日快照）
CREATE TABLE holding_profit_history (
  id SERIAL PRIMARY KEY,
  holding_id UUID REFERENCES user_holdings(id),
  date DATE NOT NULL,
  nav DECIMAL(10, 4) NOT NULL,
  profit DECIMAL(15, 4) NOT NULL,
  profit_rate DECIMAL(6, 2) NOT NULL,
  UNIQUE(holding_id, date)
);

-- 分析结果缓存（提升性能）
CREATE TABLE analysis_cache (
  id SERIAL PRIMARY KEY,
  analysis_type VARCHAR(50) NOT NULL,
  fund_code VARCHAR(10),
  params JSONB,
  result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);
```

### 4.2 Next.js API 设计

```typescript
// API 路由规划

// 持仓管理
POST   /api/holdings           // 创建持仓
GET    /api/holdings           // 获取持仓列表
PUT    /api/holdings/:id       // 更新持仓
DELETE /api/holdings/:id       // 删除持仓

// 收益计算
GET    /api/holdings/profit           // 获取所有持仓收益
GET    /api/holdings/:id/profit       // 单只持仓收益详情
GET    /api/holdings/summary          // 收益汇总统计

// 基金分析
GET    /api/funds/:code/analysis      // 单只基金分析
POST   /api/funds/compare             // 多只基金对比

// 定投模拟
POST   /api/simulation/dca            // 定投收益模拟

// 风险指标
GET    /api/funds/:code/risk          // 风险指标
```

### 4.3 性能优化策略

1. **数据库层面**
   - 创建分析视图（Materialized View）
   - 添加复合索引
   - 使用缓存表存储计算结果

2. **应用层面**
   - Redis 缓存热点数据
   - 定时任务预计算
   - 分页加载大数据集

3. **计算层面**
   - 复杂计算用 PostgreSQL 函数
   - 实时计算用 SQL
   - 历史数据用预计算

---

## 5. 实现优先级

### Phase 1: 基础功能（高优先级）
- [ ] 用户持仓 CRUD
- [ ] 基础收益计算
- [ ] 持仓列表展示

### Phase 2: 分析功能（中优先级）
- [ ] 基金对比分析
- [ ] 定投收益模拟
- [ ] 收益走势图

### Phase 3: 高级功能（低优先级）
- [ ] 风险指标计算
- [ ] 智能定投策略
- [ ] 投资组合优化

---

## 6. 数据安全

1. **用户数据隔离**
   - 每个用户只能看到自己的持仓
   - 添加 user_id 字段隔离数据

2. **数据备份**
   - 定期备份 PostgreSQL
   - 重要操作日志记录

3. **计算安全**
   - SQL 注入防护（使用参数化查询）
   - 大数据量查询限制

---

## 7. 后续扩展

- **多用户支持**：添加用户认证体系
- **实时推送**：WebSocket 推送净值更新
- **图表展示**：集成图表库展示趋势
- **导出报告**：PDF/Excel 导出分析结果
- **告警机制**：收益达到阈值通知

---

**文档版本**: v1.0  
**创建日期**: 2026-03-10  
**最后更新**: 2026-03-10
