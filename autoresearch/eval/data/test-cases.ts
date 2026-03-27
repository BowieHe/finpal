/**
 * FinPal 搜索优化测试用例
 * 
 * 覆盖典型用户场景，用于评估搜索策略的效果
 */

export interface TestCase {
  id: string;
  category: 'fund_analysis' | 'portfolio_review' | 'market_news' | 'comparison';
  question: string;
  expectedFundCodes?: string[];    // 期望识别的基金代码
  expectedAspects?: string[];      // 期望覆盖的分析维度
  expectedSources?: string[];      // 期望的信息来源类型
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];                  // 标签用于分类筛选
}

export const testCases: TestCase[] = [
  // ========== 基金分析场景 ==========
  
  // Easy - 明确基金代码
  {
    id: 'fund-001',
    category: 'fund_analysis',
    question: '005827 这只基金怎么样？',
    expectedFundCodes: ['005827'],
    expectedAspects: ['净值走势', '基金经理', '历史业绩', '风险'],
    difficulty: 'easy',
    tags: ['单基金', '代码查询'],
  },
  {
    id: 'fund-002',
    category: 'fund_analysis',
    question: '易方达蓝筹精选基金最近表现如何？',
    expectedFundCodes: ['005827'],
    expectedAspects: ['净值走势', '基金经理', '重仓股', '规模变动'],
    difficulty: 'easy',
    tags: ['单基金', '名称查询'],
  },
  {
    id: 'fund-003',
    category: 'fund_analysis',
    question: '161725 招商白酒基金适合定投吗？',
    expectedFundCodes: ['161725'],
    expectedAspects: ['净值走势', '行业动态', '波动性', '定投建议'],
    difficulty: 'easy',
    tags: ['单基金', '定投'],
  },
  
  // Medium - 需要推断或模糊查询
  {
    id: 'fund-004',
    category: 'fund_analysis',
    question: '葛兰管理的那只医药基金现在能买吗？',
    expectedAspects: ['基金经理动态', '医药行业', '估值', '投资建议'],
    difficulty: 'medium',
    tags: ['单基金', '基金经理', '买入建议'],
  },
  {
    id: 'fund-005',
    category: 'fund_analysis',
    question: '张坤的基金最近为什么跌这么多？',
    expectedFundCodes: ['005827', '110011'],
    expectedAspects: ['净值下跌原因', '重仓股', '市场分析', '基金经理观点'],
    difficulty: 'medium',
    tags: ['单基金', '明星经理', '下跌分析'],
  },
  {
    id: 'fund-006',
    category: 'fund_analysis',
    question: '新能源主题基金现在还能持有吗？',
    expectedAspects: ['行业动态', '政策影响', '估值水平', '持有建议'],
    difficulty: 'medium',
    tags: ['主题基金', '行业分析'],
  },
  
  // Hard - 复杂分析需求
  {
    id: 'fund-007',
    category: 'fund_analysis',
    question: '帮我深度分析一下 001632 天弘中证食品饮料指数这只基金的投资价值',
    expectedFundCodes: ['001632'],
    expectedAspects: ['指数跟踪', '行业前景', '估值', '风险', '同类产品对比'],
    difficulty: 'hard',
    tags: ['指数基金', '深度分析'],
  },
  {
    id: 'fund-008',
    category: 'fund_analysis',
    question: '对比分析一下纳斯达克100指数基金和标普500指数基金哪个更适合长期持有',
    expectedAspects: ['指数对比', '历史表现', '波动性', '长期投资建议'],
    difficulty: 'hard',
    tags: ['QDII', '指数对比', '长期投资'],
  },
  
  // ========== 持仓回顾场景 ==========
  
  // Easy
  {
    id: 'portfolio-001',
    category: 'portfolio_review',
    question: '我的持仓整体表现如何？',
    expectedAspects: ['总收益', '风险分布', '行业配置'],
    difficulty: 'easy',
    tags: ['整体持仓', '表现回顾'],
  },
  {
    id: 'portfolio-002',
    category: 'portfolio_review',
    question: '看看我今天盈亏多少',
    expectedAspects: ['今日收益', '持仓变动'],
    difficulty: 'easy',
    tags: ['整体持仓', '当日盈亏'],
  },
  
  // Medium
  {
    id: 'portfolio-003',
    category: 'portfolio_review',
    question: '我的投资组合风险大吗？需要调整吗？',
    expectedAspects: ['风险评估', '行业集中度', '调整建议'],
    difficulty: 'medium',
    tags: ['整体持仓', '风险评估', '调仓建议'],
  },
  {
    id: 'portfolio-004',
    category: 'portfolio_review',
    question: '我的基金持仓在行业分布上有什么问题吗？',
    expectedAspects: ['行业配置', '集中度分析', '分散化建议'],
    difficulty: 'medium',
    tags: ['整体持仓', '行业分析'],
  },
  
  // Hard
  {
    id: 'portfolio-005',
    category: 'portfolio_review',
    question: '基于我的持仓，在当前市场环境下应该加仓、减仓还是不动？',
    expectedAspects: ['市场分析', '持仓诊断', '操作建议', '风险评估'],
    difficulty: 'hard',
    tags: ['整体持仓', '市场判断', '操作建议'],
  },
  
  // ========== 市场新闻场景 ==========
  
  // Easy
  {
    id: 'market-001',
    category: 'market_news',
    question: '今天股市怎么样？',
    expectedAspects: ['大盘走势', '市场情绪'],
    difficulty: 'easy',
    tags: ['市场概况'],
  },
  {
    id: 'market-002',
    category: 'market_news',
    question: '最近有什么影响基金市场的重大新闻吗？',
    expectedAspects: ['政策动态', '市场影响', '基金行业'],
    difficulty: 'easy',
    tags: ['市场新闻', '政策'],
  },
  
  // Medium
  {
    id: 'market-003',
    category: 'market_news',
    question: '美联储降息对 QDII 基金有什么影响？',
    expectedAspects: ['美联储政策', '汇率影响', 'QDII 策略'],
    difficulty: 'medium',
    tags: ['宏观政策', 'QDII'],
  },
  {
    id: 'market-004',
    category: 'market_news',
    question: '白酒行业最近有什么利空消息吗？',
    expectedAspects: ['行业动态', '政策影响', '消费数据'],
    difficulty: 'medium',
    tags: ['行业新闻', '白酒'],
  },
  
  // Hard
  {
    id: 'market-005',
    category: 'market_news',
    question: '分析一下中美贸易关系对科技主题基金的影响',
    expectedAspects: ['国际关系', '科技行业', '基金影响', '投资建议'],
    difficulty: 'hard',
    tags: ['宏观分析', '主题基金', '国际关系'],
  },
  
  // ========== 基金对比场景 ==========
  
  {
    id: 'compare-001',
    category: 'comparison',
    question: '005827 和 110011 这两只基金哪个更好？',
    expectedFundCodes: ['005827', '110011'],
    expectedAspects: ['业绩对比', '风险对比', '风格对比', '选择建议'],
    difficulty: 'medium',
    tags: ['基金对比', '二选一'],
  },
  {
    id: 'compare-002',
    category: 'comparison',
    question: '同样是白酒基金，招商中证白酒和鹏华酒哪个更值得投资？',
    expectedAspects: ['跟踪指数对比', '费率对比', '规模对比', '选择建议'],
    difficulty: 'medium',
    tags: ['基金对比', '同类产品'],
  },
  
  // ========== 特殊场景 ==========
  
  {
    id: 'special-001',
    category: 'fund_analysis',
    question: '我想找一只稳健型的债券基金，有什么推荐？',
    expectedAspects: ['基金筛选', '风险评估', '推荐理由'],
    difficulty: 'medium',
    tags: ['基金筛选', '债券基金'],
  },
  {
    id: 'special-002',
    category: 'portfolio_review',
    question: '我现在的持仓适合现在的市场行情吗？',
    expectedAspects: ['市场行情', '持仓匹配度', '调整建议'],
    difficulty: 'hard',
    tags: ['整体持仓', '市场匹配'],
  },
];

/**
 * 根据分类获取测试用例
 */
export function getTestCasesByCategory(category: TestCase['category']): TestCase[] {
  return testCases.filter(tc => tc.category === category);
}

/**
 * 根据难度获取测试用例
 */
export function getTestCasesByDifficulty(difficulty: TestCase['difficulty']): TestCase[] {
  return testCases.filter(tc => tc.difficulty === difficulty);
}

/**
 * 获取测试用例摘要统计
 */
export function getTestCasesSummary(): Record<string, number> {
  return {
    total: testCases.length,
    byCategory: {
      fund_analysis: testCases.filter(tc => tc.category === 'fund_analysis').length,
      portfolio_review: testCases.filter(tc => tc.category === 'portfolio_review').length,
      market_news: testCases.filter(tc => tc.category === 'market_news').length,
      comparison: testCases.filter(tc => tc.category === 'comparison').length,
    },
    byDifficulty: {
      easy: testCases.filter(tc => tc.difficulty === 'easy').length,
      medium: testCases.filter(tc => tc.difficulty === 'medium').length,
      hard: testCases.filter(tc => tc.difficulty === 'hard').length,
    },
  };
}

// 导出统计信息
export const testCasesSummary = getTestCasesSummary();
