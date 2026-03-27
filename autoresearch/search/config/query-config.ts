/**
 * 查询生成配置
 * 
 * 这个文件是 autoResearch 的实验对象。
 * AI 会基于 program.md 的目标，修改 currentQueryConfig 来进行实验。
 */

/**
 * 查询配置接口
 */
export interface QueryConfig {
  version: string;
  description?: string;
  
  // 基金分析场景（单个基金深入分析）
  fundAnalysis: {
    queryCount: number;              // 生成几个查询
    template: string;                // 查询模板
    aspects: string[];               // 分析维度
    includeHistory?: boolean;        // 是否包含历史数据查询
  };
  
  // 持仓回顾场景（整体投资组合）
  portfolioReview: {
    queryCount: number;
    includeSectorNews: boolean;      // 是否包含行业新闻
    includeMarketOverview: boolean;  // 是否包含市场概况
    includeIndividualFund: boolean;  // 是否逐个基金查询
  };
  
  // 市场新闻场景（宏观市场动态）
  marketNews: {
    queryCount: number;
    recencyWeight: number;           // 时效性权重 0-1
    includeOpinion?: boolean;        // 是否包含观点类内容
  };
  
  // 通用设置
  general: {
    maxQueryLength: number;          // 查询最大长度
    language: 'zh' | 'en' | 'mixed'; // 查询语言偏好
  };
}

/**
 * 基线配置 - 作为回滚和对比的基准
 * 这个配置不应该被修改
 */
export const baselineQueryConfig: QueryConfig = {
  version: 'baseline',
  description: '原始配置，作为实验基准',
  
  fundAnalysis: {
    queryCount: 2,
    template: '{fundCode} {aspect}',
    aspects: ['最新净值', '基金经理'],
    includeHistory: false,
  },
  
  portfolioReview: {
    queryCount: 3,
    includeSectorNews: false,
    includeMarketOverview: true,
    includeIndividualFund: false,
  },
  
  marketNews: {
    queryCount: 2,
    recencyWeight: 0.5,
    includeOpinion: true,
  },
  
  general: {
    maxQueryLength: 100,
    language: 'zh',
  },
};

/**
 * 当前实验配置
 * 
 * ⚠️ 这是 AI 进行实验时修改的文件
 * 每次实验前应该基于上一次的最佳配置或基线进行修改
 */
export const currentQueryConfig: QueryConfig = {
  version: 'baseline',
  description: '当前实验配置',
  
  fundAnalysis: {
    queryCount: 2,
    template: '{fundCode} {aspect}',
    aspects: ['最新净值', '基金经理'],
    includeHistory: false,
  },
  
  portfolioReview: {
    queryCount: 3,
    includeSectorNews: false,
    includeMarketOverview: true,
    includeIndividualFund: false,
  },
  
  marketNews: {
    queryCount: 2,
    recencyWeight: 0.5,
    includeOpinion: true,
  },
  
  general: {
    maxQueryLength: 100,
    language: 'zh',
  },
};

/**
 * 生成查询的辅助函数
 */
export function generateQueries(
  config: QueryConfig,
  scenario: 'fundAnalysis' | 'portfolioReview' | 'marketNews',
  params: {
    fundCode?: string;
    fundName?: string;
    query?: string;
  }
): string[] {
  const queries: string[] = [];
  
  switch (scenario) {
    case 'fundAnalysis': {
      const { fundCode, fundName } = params;
      if (!fundCode && !fundName) return queries;
      
      const identifier = fundCode || fundName;
      const cfg = config.fundAnalysis;
      
      for (const aspect of cfg.aspects.slice(0, cfg.queryCount)) {
        queries.push(cfg.template
          .replace('{fundCode}', identifier || '')
          .replace('{aspect}', aspect)
        );
      }
      break;
    }
    
    case 'portfolioReview': {
      const cfg = config.portfolioReview;
      queries.push('基金持仓整体表现');
      if (cfg.includeMarketOverview) queries.push('A股市场最新行情');
      if (cfg.includeSectorNews) queries.push('基金重仓行业动态');
      break;
    }
    
    case 'marketNews': {
      const { query } = params;
      if (query) queries.push(query);
      break;
    }
  }
  
  return queries.filter(q => q.length > 0 && q.length <= config.general.maxQueryLength);
}

/**
 * 导出配置摘要（用于实验记录）
 */
export function getConfigSummary(config: QueryConfig): Record<string, unknown> {
  return {
    version: config.version,
    fundAnalysis: {
      queryCount: config.fundAnalysis.queryCount,
      aspectCount: config.fundAnalysis.aspects.length,
    },
    portfolioReview: {
      queryCount: config.portfolioReview.queryCount,
      features: [
        config.portfolioReview.includeSectorNews && 'sectorNews',
        config.portfolioReview.includeMarketOverview && 'marketOverview',
        config.portfolioReview.includeIndividualFund && 'individualFund',
      ].filter(Boolean),
    },
    marketNews: {
      queryCount: config.marketNews.queryCount,
      recencyWeight: config.marketNews.recencyWeight,
    },
  };
}
