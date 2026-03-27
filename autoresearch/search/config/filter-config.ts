/**
 * 搜索结果筛选配置
 * 
 * 这个文件是 autoResearch 的实验对象。
 * 控制如何从原始搜索结果中筛选和排序最终呈现的信息。
 */

import { SearchResultItem } from '@/types/mcp';

/**
 * 筛选配置接口
 */
export interface FilterConfig {
  version: string;
  description?: string;
  
  // 数量控制
  limits: {
    maxResults: number;           // 最大返回结果数
    minResults: number;           // 最小有效结果数（低于此值视为失败）
    maxPerDomain: number;         // 同一域名最多取几条
  };
  
  // 去重设置
  deduplication: {
    enabled: boolean;             // 是否启用去重
    similarityThreshold: number;  // 相似度阈值（0-1）
    preferRecent: boolean;        // 重复时是否优先较新的
  };
  
  // 排序策略
  ranking: {
    strategy: 'relevance' | 'recency' | 'balanced' | 'diversity';
    recencyWeight: number;        // 时效性权重（0-1）
    relevanceWeight: number;      // 相关性权重（0-1）
    diversityWeight: number;      // 多样性权重（0-1）
    boostDomains?: string[];      // 优先域名列表
  };
  
  // 内容过滤
  filtering: {
    minDescriptionLength: number; // 描述最小长度
    maxDescriptionLength: number; // 描述最大长度（截断）
    excludePatterns?: string[];   // 排除的关键词模式
    requirePatterns?: string[];   // 必须包含的关键词
  };
  
  // 摘要生成
  summarization: {
    maxSummaryLength: number;     // 摘要最大长度
    includeTitles: boolean;       // 是否包含标题列表
    maxTitlesInSummary: number;   // 摘要中包含的标题数
  };
}

/**
 * 基线配置
 */
export const baselineFilterConfig: FilterConfig = {
  version: 'baseline',
  description: '原始配置，取前 8 条结果',
  
  limits: {
    maxResults: 8,
    minResults: 3,
    maxPerDomain: 3,
  },
  
  deduplication: {
    enabled: false,
    similarityThreshold: 0.8,
    preferRecent: true,
  },
  
  ranking: {
    strategy: 'relevance',
    recencyWeight: 0.3,
    relevanceWeight: 0.7,
    diversityWeight: 0.0,
    boostDomains: ['eastmoney.com', 'cninfo.com.cn', 'fund.eastmoney.com'],
  },
  
  filtering: {
    minDescriptionLength: 10,
    maxDescriptionLength: 300,
    excludePatterns: [],
    requirePatterns: [],
  },
  
  summarization: {
    maxSummaryLength: 500,
    includeTitles: true,
    maxTitlesInSummary: 5,
  },
};

/**
 * 当前实验配置
 * 
 * ⚠️ 这是 AI 进行实验时修改的文件
 */
export const currentFilterConfig: FilterConfig = {
  version: 'baseline',
  description: '当前实验配置',
  
  limits: {
    maxResults: 8,
    minResults: 3,
    maxPerDomain: 3,
  },
  
  deduplication: {
    enabled: false,
    similarityThreshold: 0.8,
    preferRecent: true,
  },
  
  ranking: {
    strategy: 'relevance',
    recencyWeight: 0.3,
    relevanceWeight: 0.7,
    diversityWeight: 0.0,
    boostDomains: ['eastmoney.com', 'cninfo.com.cn', 'fund.eastmoney.com'],
  },
  
  filtering: {
    minDescriptionLength: 10,
    maxDescriptionLength: 300,
    excludePatterns: [],
    requirePatterns: [],
  },
  
  summarization: {
    maxSummaryLength: 500,
    includeTitles: true,
    maxTitlesInSummary: 5,
  },
};

/**
 * 简单的文本相似度计算（基于共同子串）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const s1 = text1.toLowerCase();
  const s2 = text2.toLowerCase();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  // 简单的 Jaccard 相似度（基于字符）
  const set1 = new Set(s1.split(''));
  const set2 = new Set(s2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * 应用筛选配置处理搜索结果
 */
export function filterSearchResults(
  results: SearchResultItem[],
  config: FilterConfig
): SearchResultItem[] {
  if (!results || results.length === 0) return [];
  
  let filtered = [...results];
  
  // 1. 基础过滤
  filtered = filtered.filter(item => {
    const desc = item.description || '';
    return desc.length >= config.filtering.minDescriptionLength;
  });
  
  // 2. 关键词过滤
  if (config.filtering.excludePatterns && config.filtering.excludePatterns.length > 0) {
    filtered = filtered.filter(item => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return !config.filtering.excludePatterns!.some(pattern => 
        text.includes(pattern.toLowerCase())
      );
    });
  }
  
  if (config.filtering.requirePatterns && config.filtering.requirePatterns.length > 0) {
    filtered = filtered.filter(item => {
      const text = `${item.title} ${item.description}`.toLowerCase();
      return config.filtering.requirePatterns!.some(pattern =>
        text.includes(pattern.toLowerCase())
      );
    });
  }
  
  // 3. 去重
  if (config.deduplication.enabled) {
    const unique: SearchResultItem[] = [];
    for (const item of filtered) {
      const isDuplicate = unique.some(existing =>
        calculateSimilarity(
          `${existing.title} ${existing.description}`,
          `${item.title} ${item.description}`
        ) > config.deduplication.similarityThreshold
      );
      if (!isDuplicate) unique.push(item);
    }
    filtered = unique;
  }
  
  // 4. 域名限制
  const domainCounts: Record<string, number> = {};
  filtered = filtered.filter(item => {
    try {
      const domain = new URL(item.url).hostname;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      return domainCounts[domain] <= config.limits.maxPerDomain;
    } catch {
      return true;
    }
  });
  
  // 5. 截断结果数量
  filtered = filtered.slice(0, config.limits.maxResults);
  
  // 6. 截断描述长度
  filtered = filtered.map(item => ({
    ...item,
    description: item.description?.slice(0, config.filtering.maxDescriptionLength) || '',
  }));
  
  return filtered;
}

/**
 * 生成搜索结果摘要
 */
export function generateSearchSummary(
  results: SearchResultItem[],
  config: FilterConfig
): string {
  if (!results || results.length === 0) {
    return '未找到相关搜索结果';
  }
  
  if (config.summarization.includeTitles) {
    const titles = results
      .slice(0, config.summarization.maxTitlesInSummary)
      .map(r => r.title)
      .filter(Boolean);
    return titles.join('；');
  }
  
  return `找到 ${results.length} 条相关结果`;
}

/**
 * 导出配置摘要
 */
export function getFilterConfigSummary(config: FilterConfig): Record<string, unknown> {
  return {
    version: config.version,
    maxResults: config.limits.maxResults,
    strategy: config.ranking.strategy,
    dedupEnabled: config.deduplication.enabled,
  };
}
