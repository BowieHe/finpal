/**
 * 专业数据源配置
 * 根据用户提供的分类整理
 */

import { SpecializedSource, QueryCategory } from '@/types/mcp';

/**
 * 权威新闻媒体 - 实时资讯、市场动态和深度报道
 */
export const NEWS_SOURCES: SpecializedSource[] = [
  {
    name: '路透社',
    url: 'https://www.reuters.com',
    category: 'finance_news',
    description: '全球权威财经新闻',
    searchUrl: 'https://www.reuters.com/site-search/?query={query}',
  },
  {
    name: '彭博社',
    url: 'https://www.bloomberg.com',
    category: 'finance_news',
    description: '全球金融数据与新闻',
    searchUrl: 'https://www.bloomberg.com/search?query={query}',
  },
  {
    name: '华尔街见闻',
    url: 'https://wallstreetcn.com',
    category: 'finance_news',
    description: '中国领先的金融资讯平台',
    searchUrl: 'https://wallstreetcn.com/search?q={query}',
  },
  {
    name: '财新网',
    url: 'https://www.caixin.com',
    category: 'finance_news',
    description: '中国高端财经新闻',
    searchUrl: 'https://search.caixin.com/search/search.jsp?keyword={query}',
  },
  {
    name: '第一财经',
    url: 'https://www.yicai.com',
    category: 'finance_news',
    description: '中国主流财经媒体',
    searchUrl: 'https://www.yicai.com/search?keys={query}',
  },
];

/**
 * 专业财经平台 - 股票、基金、黄金的实时行情和历史数据
 */
export const FINANCE_DATA_SOURCES: SpecializedSource[] = [
  {
    name: '东方财富网',
    url: 'https://www.eastmoney.com',
    category: 'finance_data',
    description: '中国领先的财经门户，股票基金数据',
    searchUrl: 'https://search.eastmoney.com/search?keyword={query}',
  },
  {
    name: '雪球',
    url: 'https://xueqiu.com',
    category: 'finance_data',
    description: '投资者社区，股票讨论',
    searchUrl: 'https://xueqiu.com/search?q={query}',
  },
  {
    name: '同花顺',
    url: 'https://www.10jqka.com.cn',
    category: 'finance_data',
    description: '股票行情与财经数据',
    searchUrl: 'https://search.10jqka.com.cn/?tid=info&qs=return_content&w={query}',
  },
  {
    name: 'Google Finance',
    url: 'https://www.google.com/finance',
    category: 'finance_data',
    description: '全球金融市场数据',
    searchUrl: 'https://www.google.com/search?q={query}+stock',
  },
];

/**
 * 百科与知识库 - 基础概念解释
 */
export const ENCYCLOPEDIA_SOURCES: SpecializedSource[] = [
  {
    name: '维基百科',
    url: 'https://en.wikipedia.org',
    category: 'encyclopedia',
    description: '全球最大的免费百科全书',
    searchUrl: 'https://en.wikipedia.org/wiki/Special:Search?search={query}',
  },
  {
    name: '百度百科',
    url: 'https://baike.baidu.com',
    category: 'encyclopedia',
    description: '中文最大的百科全书',
    searchUrl: 'https://baike.baidu.com/search?word={query}',
  },
  {
    name: 'Wikidata',
    url: 'https://www.wikidata.org',
    category: 'encyclopedia',
    description: '结构化知识库',
    searchUrl: 'https://www.wikidata.org/w/index.php?search={query}',
  },
];

/**
 * 学术研究资源 - 深度研究和量化分析
 */
export const ACADEMIC_SOURCES: SpecializedSource[] = [
  {
    name: 'Google Scholar',
    url: 'https://scholar.google.com',
    category: 'academic',
    description: '学术文献搜索引擎',
    searchUrl: 'https://scholar.google.com/scholar?q={query}',
  },
  {
    name: 'arXiv',
    url: 'https://arxiv.org',
    category: 'academic',
    description: '预印本论文库',
    searchUrl: 'https://arxiv.org/search/?query={query}',
  },
  {
    name: '中国知网',
    url: 'https://www.cnki.net',
    category: 'academic',
    description: '中文学术期刊数据库',
    searchUrl: 'https://kns.cnki.net/kns8/defaultresult/index',
  },
];

/**
 * 政府与国际组织 - 宏观经济数据和官方统计
 */
export const GOVERNMENT_SOURCES: SpecializedSource[] = [
  {
    name: 'World Bank',
    url: 'https://www.worldbank.org',
    category: 'government',
    description: '世界银行数据与报告',
    searchUrl: 'https://www.worldbank.org/en/search?q={query}',
  },
  {
    name: 'IMF',
    url: 'https://www.imf.org',
    category: 'government',
    description: '国际货币基金组织',
    searchUrl: 'https://www.imf.org/en/search#q={query}',
  },
  {
    name: '中国证监会',
    url: 'http://www.csrc.gov.cn',
    category: 'government',
    description: '中国证券监管政策',
    searchUrl: 'http://www.csrc.gov.cn/csrc/search.shtml?keywords={query}',
  },
  {
    name: '国家统计局',
    url: 'https://www.stats.gov.cn',
    category: 'government',
    description: '中国官方统计数据',
    searchUrl: 'https://www.stats.gov.cn/search/s?wd={query}',
  },
];

/**
 * 问答与社区 - 市场观点和投资者情绪
 */
export const COMMUNITY_SOURCES: SpecializedSource[] = [
  {
    name: '知乎',
    url: 'https://www.zhihu.com',
    category: 'community',
    description: '中文问答社区',
    searchUrl: 'https://www.zhihu.com/search?type=content&q={query}',
  },
  {
    name: 'Quora',
    url: 'https://www.quora.com',
    category: 'community',
    description: '英文问答社区',
    searchUrl: 'https://www.quora.com/search?q={query}',
  },
  {
    name: 'Reddit',
    url: 'https://www.reddit.com',
    category: 'community',
    description: '全球社区讨论',
    searchUrl: 'https://www.reddit.com/search/?q={query}',
  },
];

/**
 * 所有数据源汇总（按类别分组）
 */
export const SPECIALIZED_SOURCES: Record<QueryCategory, SpecializedSource[]> = {
  general: [],
  finance_news: NEWS_SOURCES,
  finance_data: FINANCE_DATA_SOURCES,
  encyclopedia: ENCYCLOPEDIA_SOURCES,
  academic: ACADEMIC_SOURCES,
  government: GOVERNMENT_SOURCES,
  community: COMMUNITY_SOURCES,
};

/**
 * 所有数据源汇总（数组形式）
 */
export const ALL_SPECIALIZED_SOURCES: SpecializedSource[] = [
  ...NEWS_SOURCES,
  ...FINANCE_DATA_SOURCES,
  ...ENCYCLOPEDIA_SOURCES,
  ...ACADEMIC_SOURCES,
  ...GOVERNMENT_SOURCES,
  ...COMMUNITY_SOURCES,
];

/**
 * 根据类别获取数据源
 */
export function getSourcesByCategory(category: QueryCategory): SpecializedSource[] {
  return ALL_SPECIALIZED_SOURCES.filter(source => source.category === category);
}

/**
 * 获取最适合搜索的数据源（每个类别取前2个）
 */
export function getRecommendedSources(category: QueryCategory): SpecializedSource[] {
  const sources = getSourcesByCategory(category);

  // 根据类别优先级推荐
  switch (category) {
    case 'finance_news':
      return sources.slice(0, 2); // 路透社、彭博社
    case 'finance_data':
      return sources.slice(0, 2); // 东方财富、雪球
    case 'encyclopedia':
      return sources.slice(0, 1); // 维基百科
    case 'academic':
      return sources.slice(0, 2); // Google Scholar, arXiv
    case 'government':
      return sources.slice(0, 2); // World Bank, IMF
    case 'community':
      return sources.slice(0, 2); // 知乎, Quora
    default:
      return [];
  }
}
