/**
 * 查询分类器
 * 使用 LLM 判断查询类型，决定使用何种搜索策略
 */

import { QueryCategory, QueryClassification } from '@/types/mcp';
import { getLLMInstance } from '../llm/client';

/**
 * 查询类别定义和描述
 */
const CATEGORY_DESCRIPTIONS: Record<QueryCategory, string> = {
  general: '一般性问题，如"什么是人工智能"、"如何学习编程"等通用知识查询',
  finance_news: '财经新闻和实时资讯，如"最新股市动态"、"美联储利率决议"、"某公司业绩"等',
  finance_data: '股票、基金、行情数据查询，如"特斯拉股价"、"某基金净值"、"黄金价格"等',
  encyclopedia: '百科知识查询，如"什么是ETF"、"黄金避险属性"、"某概念定义"等',
  academic: '学术研究和量化分析，如"某论文研究"、"金融模型"、"实证分析"等',
  government: '政府政策和国际组织数据，如"GDP数据"、"央行政策"、"监管规定"等',
  community: '问答社区观点，如"某股票怎么看"、"投资策略讨论"、"市场情绪"等',
};

/**
 * 使用 LLM 分类查询
 */
export async function classifyQuery(query: string): Promise<QueryClassification> {
  const llm = getLLMInstance();

  const prompt = `你是一个查询分类专家。请分析以下用户查询，判断它属于哪个类别。

用户查询："${query}"

可选类别：
${Object.entries(CATEGORY_DESCRIPTIONS)
  .map(([cat, desc]) => `- ${cat}: ${desc}`)
  .join('\n')}

请严格以 JSON 格式返回（不要包含其他文字）：
{
  "category": "类别名称",
  "confidence": 0.95,
  "reasoning": "分类理由",
  "suggestedSources": ["建议使用的数据源名称1", "数据源名称2"]
}

注意：
- category 必须是上述类别之一
- confidence 是 0-1 之间的置信度
- 如果查询涉及多个类别，选择最主要的一个
- suggestedSources 填写最相关的1-2个数据源名称`;

  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // 尝试从响应中提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从 LLM 响应中提取 JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 验证类别有效性
    const validCategories = Object.keys(CATEGORY_DESCRIPTIONS);
    if (!validCategories.includes(parsed.category)) {
      console.warn(`[QueryClassifier] 无效类别: ${parsed.category}，回退到 general`);
      parsed.category = 'general';
    }

    return {
      category: parsed.category as QueryCategory,
      confidence: Number(parsed.confidence) || 0.5,
      reasoning: String(parsed.reasoning) || '',
      suggestedSources: Array.isArray(parsed.suggestedSources)
        ? parsed.suggestedSources
        : [],
    };
  } catch (error) {
    console.error('[QueryClassifier] 分类失败:', error);

    // 回退到通用分类
    return {
      category: 'general',
      confidence: 0.3,
      reasoning: '分类失败，使用默认类别',
      suggestedSources: [],
    };
  }
}

/**
 * 快速分类（基于关键词规则）
 * 用于不需要 LLM 的简单场景
 */
export function quickClassify(query: string): QueryCategory {
  const lowerQuery = query.toLowerCase();

  // 财经数据关键词
  const financeDataKeywords = [
    '股价', '股票', '基金', '净值', '行情', '价格', '涨', '跌',
    '市值', '市盈率', '收益率', '黄金', '原油', '期货',
    'stock', 'fund', 'price', 'share', 'market cap', 'p/e'
  ];
  if (financeDataKeywords.some(k => lowerQuery.includes(k))) {
    return 'finance_data';
  }

  // 财经新闻关键词
  const financeNewsKeywords = [
    '新闻', '资讯', '动态', '报道', '公告', '财报', '业绩',
    '美联储', '央行', '利率', '政策', 'news', 'report', 'earnings'
  ];
  if (financeNewsKeywords.some(k => lowerQuery.includes(k))) {
    return 'finance_news';
  }

  // 学术关键词
  const academicKeywords = [
    '论文', '研究', '学术', '模型', '量化', '实证', '期刊',
    'paper', 'research', 'study', 'model', 'empirical', 'arxiv'
  ];
  if (academicKeywords.some(k => lowerQuery.includes(k))) {
    return 'academic';
  }

  // 政府/政策关键词
  const governmentKeywords = [
    'gdp', 'cpi', 'ppi', '统计局', '证监会', 'imf', '世界银行',
    '政策', '法规', '监管', 'macro', 'policy', 'regulation'
  ];
  if (governmentKeywords.some(k => lowerQuery.includes(k))) {
    return 'government';
  }

  // 百科关键词
  const encyclopediaKeywords = [
    '什么是', '什么叫', '定义', '概念', '百科', '解释',
    'what is', 'definition', 'meaning of', 'wiki'
  ];
  if (encyclopediaKeywords.some(k => lowerQuery.includes(k))) {
    return 'encyclopedia';
  }

  // 社区讨论关键词
  const communityKeywords = [
    '怎么看', '怎么样', '如何评价', '观点', '讨论',
    'reddit', '知乎', 'quora', 'opinion', 'thoughts on'
  ];
  if (communityKeywords.some(k => lowerQuery.includes(k))) {
    return 'community';
  }

  return 'general';
}

/**
 * 判断是否应该使用专业数据源
 */
export function shouldUseSpecializedSource(category: QueryCategory): boolean {
  return category !== 'general';
}
