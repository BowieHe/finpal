/**
 * Fund Debate Skill
 *
 * 多轮多空辩论（带每轮裁决）：
 * - Round 1: 多头初始观点 + 空头初始观点
 * - Round N: 双方 rebuttal
 * - 每轮后由 decider 判断是否继续
 */

import { getLLMInstance } from '@/lib/llm/client';
import { createLogger } from '@/lib/logger';
import {
  ISkill,
  SkillMetadata,
  FundDebateInput,
  FundDebateData,
  FundDeepSearchData
} from '../types';
import { SkillInput, SkillOutput, ProgressEvent } from '../../core/types';

const logger = createLogger('FundDebateSkill');

const METADATA: SkillMetadata = {
  name: 'fund-debate',
  description: '基于研究数据进行多轮多空辩论，并在每轮后由 decider 判断是否继续。',
  version: '2.0.0',
  triggers: ['分析', '辩论', '多空', '观点', '建议'],
  requiredTools: ['llm'],
  outputSchema: 'fund_debate_package',
};

const MAX_ROUNDS = 3;
const MIN_ROUNDS = 2;

type JudgeDecision = {
  winner: 'optimistic' | 'pessimistic' | 'draw';
  shouldContinue: boolean;
  reason: string;
};

type FinalSynthesis = {
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell' | 'info_only';
  conviction: number;
  keyFactors: string[];
  timeHorizon: string;
  summary: string;
  evCalculation?: {
    upsideScenario: { probability: number; return: number };
    baseScenario: { probability: number; return: number };
    downsideScenario: { probability: number; return: number };
    expectedReturn: number;
  };
};

function extractJson<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)```/) ||
      content.match(/```\s*([\s\S]*?)```/) ||
      content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) return null;
    const candidate = jsonMatch[1] || jsonMatch[0];
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }
}

function buildResearchContext(entity: string, researchData: FundDeepSearchData): string {
  const fundInfo = researchData.fundInfo || {};
  const news = (researchData.news || []).slice(0, 8);
  const risks = (researchData.risks || []).slice(0, 8);
  const sources = (researchData.sources || []).slice(0, 10);

  return `# 分析对象
- 名称: ${entity}
- 代码: ${fundInfo.code || '未知'}
- 类型: ${fundInfo.type || '待确认'}

# 研究数据
## 基本信息
${JSON.stringify(fundInfo, null, 2)}

## 新闻 (${news.length} 条)
${news.map((n, i) => `${i + 1}. [${n.sentiment}] ${n.title}${n.summary ? ` - ${n.summary}` : ''}`).join('\n') || '无'}

## 风险线索 (${risks.length} 条)
${risks.map((r, i) => `${i + 1}. ${r}`).join('\n') || '无'}

## 来源 (${sources.length} 条)
${sources.map((s, i) => `${i + 1}. ${s}`).join('\n') || '无'}
`;
}

function buildBullInitialPrompt(entity: string, researchData: FundDeepSearchData): string {
  return `你现在扮演**多头分析师**。请给出对 ${entity} 的看多论证。

${buildResearchContext(entity, researchData)}

输出要求：
1. 使用 **Markdown**，至少 4 段，包含：
- 结论（1 段）
- 证据链（至少 3 条）
- 催化剂（至少 3 条）
- 风险应对（至少 2 条）
2. 不要空话，必须引用数据或事实线索。
3. 最后输出 JSON（必须）：
{
  "content": "Markdown正文",
  "catalysts": ["...", "..."],
  "confidence": 0-100
}`;
}

function buildBearInitialPrompt(entity: string, researchData: FundDeepSearchData, bullText: string): string {
  return `你现在扮演**空头分析师**。请反驳多头观点并给出看空论证。

${buildResearchContext(entity, researchData)}

## 多头观点（供反驳）
${bullText}

输出要求：
1. 使用 **Markdown**，至少 4 段，包含：
- 反驳主结论（1 段）
- 风险链路（至少 3 条）
- 触发条件（至少 3 条）
- 失效条件（至少 2 条）
2. 必须指出多头论证中的薄弱点。
3. 最后输出 JSON（必须）：
{
  "content": "Markdown正文",
  "risks": ["...", "..."],
  "confidence": 0-100
}`;
}

function buildRebuttalPrompt(
  side: 'optimistic' | 'pessimistic',
  entity: string,
  round: number,
  ownLast: string,
  opponentLast: string,
  researchData: FundDeepSearchData
): string {
  const role = side === 'optimistic' ? '多头分析师' : '空头分析师';
  const target = side === 'optimistic' ? '看多立场' : '看空立场';

  return `你是${role}，现在进入第 ${round} 轮辩论，请继续维护${target}。

${buildResearchContext(entity, researchData)}

## 你的上一轮观点
${ownLast}

## 对手上一轮观点
${opponentLast}

输出要求：
1. 使用 **Markdown**，不少于 3 段。
2. 必须逐点回应对手至少 2 个核心论点。
3. 给出新的补充论据至少 2 条。
4. 最后输出 JSON（必须）：
{
  "content": "Markdown正文",
  "confidence": 0-100
}`;
}

function buildJudgePrompt(
  entity: string,
  round: number,
  optimisticText: string,
  pessimisticText: string
): string {
  return `你是中立裁判（decider），请判断第 ${round} 轮辩论后是否需要继续下一轮。

分析对象: ${entity}

## 多头本轮观点
${optimisticText}

## 空头本轮观点
${pessimisticText}

请输出 JSON：
{
  "winner": "optimistic" | "pessimistic" | "draw",
  "shouldContinue": true | false,
  "reason": "简短说明（50-120字）"
}

决策规则：
- 如果双方仍有实质分歧、且新增信息明显，shouldContinue=true
- 如果观点已重复或边际信息很少，shouldContinue=false`;
}

function buildFinalSynthesisPrompt(
  entity: string,
  rounds: Array<{ round: number; optimistic: string; pessimistic: string; judge: JudgeDecision; }>
): string {
  return `你是投资决策总结官，请基于以下多轮辩论给出最终建议。

分析对象: ${entity}

辩论过程：
${rounds.map(r => `## Round ${r.round}
### 多头
${r.optimistic}
### 空头
${r.pessimistic}
### 裁决
- winner: ${r.judge.winner}
- shouldContinue: ${r.judge.shouldContinue}
- reason: ${r.judge.reason}`).join('\n\n')}

输出 JSON：
{
  "recommendation": "strong_buy|buy|hold|reduce|sell|info_only",
  "conviction": 0-100,
  "keyFactors": ["至少3条"],
  "timeHorizon": "如 3-6个月/6-12个月",
  "summary": "Markdown 格式总结，至少 3 段",
  "evCalculation": {
    "upsideScenario": { "probability": 0-1, "return": -1~1 },
    "baseScenario": { "probability": 0-1, "return": -1~1 },
    "downsideScenario": { "probability": 0-1, "return": -1~1 },
    "expectedReturn": -1~1
  }
}`;
}

function normalizeJudgeDecision(raw: Partial<JudgeDecision> | null): JudgeDecision {
  const winner = raw?.winner === 'optimistic' || raw?.winner === 'pessimistic' || raw?.winner === 'draw'
    ? raw.winner
    : 'draw';

  return {
    winner,
    shouldContinue: Boolean(raw?.shouldContinue),
    reason: raw?.reason?.trim() || '观点仍有分歧，建议继续一轮以确认关键分歧点。',
  };
}

function safeMarkdown(text?: string): string {
  if (!text) return '暂无观点。';
  return text.trim();
}

function generateDefaultOutput(entity: string): FundDebateData {
  return {
    bullCase: {
      thesis: `## 多头观点\n\n基于现有信息，${entity} 具备一定的配置价值，但仍需补齐数据细节后再提升仓位。`,
      catalysts: ['宏观流动性改善', '风险偏好修复', '基本面边际改善'],
      confidence: 55,
    },
    bearCase: {
      thesis: `## 空头观点\n\n当前证据不足以支持激进配置，仍需警惕估值与波动风险。`,
      risks: ['信息不完整', '短期波动风险', '策略执行偏差'],
      confidence: 55,
    },
    synthesis: {
      recommendation: 'info_only',
      conviction: 55,
      keyFactors: ['证据链不足', '需要更多高置信数据'],
      timeHorizon: '待确认',
      summary: `## 综合建议\n\n当前更适合“信息补齐优先”，而不是直接做大幅仓位调整。`,
    },
    rounds: [],
  };
}

function calculateOverallConfidence(data: FundDebateData): number {
  const bullConf = data.bullCase.confidence || 50;
  const bearConf = data.bearCase.confidence || 50;
  const synthesisConf = data.synthesis.conviction || 50;
  return (bullConf * 0.3 + bearConf * 0.3 + synthesisConf * 0.4) / 100;
}

export class FundDebateSkill implements ISkill {
  readonly metadata = METADATA;

  async execute(input: SkillInput, onProgress?: (event: ProgressEvent) => void): Promise<SkillOutput> {
    const startTime = Date.now();
    const typedInput = input as FundDebateInput;
    const entity = typedInput.entity;

    logger.info('Executing fund-debate', {
      entity,
      hasResearchData: !!typedInput.researchData,
      maxRounds: MAX_ROUNDS,
    });

    onProgress?.({
      type: 'acting',
      step: 1,
      message: '开始多轮多空辩论...',
      eventDetail: {
        eventType: 'analyze',
        label: '多空分析',
        detail: `分析对象: ${entity}`,
        metadata: { entity, maxRounds: MAX_ROUNDS }
      }
    });

    let rounds: Array<{ round: number; optimistic: string; pessimistic: string; judge: JudgeDecision; }> = [];
    let latestOptimistic = '';
    let latestPessimistic = '';
    let bullCatalysts: string[] = [];
    let bearRisks: string[] = [];
    let bullConfidence = 55;
    let bearConfidence = 55;

    try {
      const llm = await getLLMInstance();

      onProgress?.({
        type: 'thinking',
        step: 2,
        message: '生成首轮多头观点...',
        eventDetail: {
          eventType: 'thinking',
          label: '首轮观点',
          detail: '多头正在构建论证',
          metadata: { round: 1, side: 'optimistic' }
        }
      });

      const bullResp = await llm.invoke(buildBullInitialPrompt(entity, typedInput.researchData));
      const bullRaw = typeof bullResp.content === 'string' ? bullResp.content : JSON.stringify(bullResp.content);
      const bullParsed = extractJson<{ content: string; catalysts?: string[]; confidence?: number }>(bullRaw);
      const bullRound1 = safeMarkdown(bullParsed?.content);
      bullCatalysts = bullParsed?.catalysts?.slice(0, 6) || [];
      bullConfidence = Math.min(100, Math.max(30, Number(bullParsed?.confidence ?? 65)));

      logger.info('Bull round 1 generated', {
        length: bullRound1.length,
        confidence: bullConfidence,
        preview: bullRound1.slice(0, 180),
      });

      onProgress?.({
        type: 'optimistic_output',
        step: 2,
        message: '多头首轮发言完成',
        data: {
          answer: bullRound1,
          thinking: bullCatalysts.join('\n'),
        },
        eventDetail: {
          eventType: 'analyze',
          label: '多头首轮',
          detail: `输出 ${bullRound1.length} 字`,
          metadata: { round: 1, side: 'optimistic', confidence: bullConfidence }
        }
      });

      onProgress?.({
        type: 'thinking',
        step: 3,
        message: '生成首轮空头观点...',
        eventDetail: {
          eventType: 'thinking',
          label: '首轮观点',
          detail: '空头正在构建反驳',
          metadata: { round: 1, side: 'pessimistic' }
        }
      });

      const bearResp = await llm.invoke(buildBearInitialPrompt(entity, typedInput.researchData, bullRound1));
      const bearRaw = typeof bearResp.content === 'string' ? bearResp.content : JSON.stringify(bearResp.content);
      const bearParsed = extractJson<{ content: string; risks?: string[]; confidence?: number }>(bearRaw);
      const bearRound1 = safeMarkdown(bearParsed?.content);
      bearRisks = bearParsed?.risks?.slice(0, 6) || [];
      bearConfidence = Math.min(100, Math.max(30, Number(bearParsed?.confidence ?? 65)));

      logger.info('Bear round 1 generated', {
        length: bearRound1.length,
        confidence: bearConfidence,
        preview: bearRound1.slice(0, 180),
      });

      onProgress?.({
        type: 'pessimistic_output',
        step: 3,
        message: '空头首轮发言完成',
        data: {
          answer: bearRound1,
          thinking: bearRisks.join('\n'),
        },
        eventDetail: {
          eventType: 'analyze',
          label: '空头首轮',
          detail: `输出 ${bearRound1.length} 字`,
          metadata: { round: 1, side: 'pessimistic', confidence: bearConfidence }
        }
      });

      latestOptimistic = bullRound1;
      latestPessimistic = bearRound1;
      let finalJudge: JudgeDecision = { winner: 'draw', shouldContinue: false, reason: '首轮完成，待裁决。' };

      for (let round = 1; round <= MAX_ROUNDS; round++) {
        onProgress?.({
          type: 'node_start',
          step: 4 + round,
          message: `第 ${round} 轮裁决中...`,
          data: {
            node: 'round_judge',
            round,
            message: `第 ${round} 轮裁决中...`,
          },
          eventDetail: {
            eventType: 'thinking',
            label: '轮次裁决',
            detail: `评估第 ${round} 轮是否继续`,
            metadata: { round }
          }
        });

        const judgeResp = await llm.invoke(buildJudgePrompt(entity, round, latestOptimistic, latestPessimistic));
        const judgeRaw = typeof judgeResp.content === 'string' ? judgeResp.content : JSON.stringify(judgeResp.content);
        const judgeParsed = extractJson<JudgeDecision>(judgeRaw);
        const judge = normalizeJudgeDecision(judgeParsed);
        finalJudge = judge;

        logger.info('Round judged', { round, ...judge });

        onProgress?.({
          type: 'round_judge',
          step: 4 + round,
          message: `第 ${round} 轮裁决: ${judge.winner}`,
          data: {
            round,
            winner: judge.winner,
            shouldContinue: round < MIN_ROUNDS || (judge.shouldContinue && round < MAX_ROUNDS),
            reason: judge.reason,
          },
          eventDetail: {
            eventType: 'analyze',
            label: '裁决结果',
            detail: `winner=${judge.winner}, continue=${round < MIN_ROUNDS || (judge.shouldContinue && round < MAX_ROUNDS)}`,
            metadata: {
              round,
              winner: judge.winner,
              shouldContinue: round < MIN_ROUNDS || (judge.shouldContinue && round < MAX_ROUNDS)
            }
          }
        });

        const shouldContinue = round < MIN_ROUNDS || (judge.shouldContinue && round < MAX_ROUNDS);

        rounds.push({
          round,
          optimistic: latestOptimistic,
          pessimistic: latestPessimistic,
          judge: {
            ...judge,
            shouldContinue,
          },
        });

        if (!shouldContinue || round >= MAX_ROUNDS) {
          break;
        }

        const nextRound = round + 1;
        onProgress?.({
          type: 'node_start',
          step: 8 + nextRound,
          message: `进入第 ${nextRound} 轮辩论`,
          data: {
            node: 'round_judge',
            round: nextRound,
            message: `进入第 ${nextRound} 轮辩论`,
          },
          eventDetail: {
            eventType: 'thinking',
            label: '进入下一轮',
            detail: `第 ${nextRound} 轮 rebuttal`,
            metadata: { round: nextRound }
          }
        });

        const bullRebuttalResp = await llm.invoke(
          buildRebuttalPrompt('optimistic', entity, nextRound, latestOptimistic, latestPessimistic, typedInput.researchData)
        );
        const bullRebuttalRaw = typeof bullRebuttalResp.content === 'string'
          ? bullRebuttalResp.content
          : JSON.stringify(bullRebuttalResp.content);
        const bullRebuttalParsed = extractJson<{ content: string; confidence?: number }>(bullRebuttalRaw);
        latestOptimistic = safeMarkdown(bullRebuttalParsed?.content);

        logger.info('Bull rebuttal generated', {
          round: nextRound,
          length: latestOptimistic.length,
          preview: latestOptimistic.slice(0, 180),
        });

        onProgress?.({
          type: 'optimistic_rebuttal',
          step: 8 + nextRound,
          message: `多头第 ${nextRound} 轮发言`,
          data: {
            round: nextRound,
            rebuttal: latestOptimistic,
          },
          eventDetail: {
            eventType: 'analyze',
            label: `多头第 ${nextRound} 轮`,
            detail: `输出 ${latestOptimistic.length} 字`,
            metadata: { round: nextRound, side: 'optimistic' }
          }
        });

        const bearRebuttalResp = await llm.invoke(
          buildRebuttalPrompt('pessimistic', entity, nextRound, latestPessimistic, latestOptimistic, typedInput.researchData)
        );
        const bearRebuttalRaw = typeof bearRebuttalResp.content === 'string'
          ? bearRebuttalResp.content
          : JSON.stringify(bearRebuttalResp.content);
        const bearRebuttalParsed = extractJson<{ content: string; confidence?: number }>(bearRebuttalRaw);
        latestPessimistic = safeMarkdown(bearRebuttalParsed?.content);

        logger.info('Bear rebuttal generated', {
          round: nextRound,
          length: latestPessimistic.length,
          preview: latestPessimistic.slice(0, 180),
        });

        onProgress?.({
          type: 'pessimistic_rebuttal',
          step: 9 + nextRound,
          message: `空头第 ${nextRound} 轮发言`,
          data: {
            round: nextRound,
            rebuttal: latestPessimistic,
          },
          eventDetail: {
            eventType: 'analyze',
            label: `空头第 ${nextRound} 轮`,
            detail: `输出 ${latestPessimistic.length} 字`,
            metadata: { round: nextRound, side: 'pessimistic' }
          }
        });
      }

      const synthesisResp = await llm.invoke(buildFinalSynthesisPrompt(entity, rounds));
      const synthesisRaw = typeof synthesisResp.content === 'string'
        ? synthesisResp.content
        : JSON.stringify(synthesisResp.content);
      const synthesisParsed = extractJson<FinalSynthesis>(synthesisRaw);

      const synthesis: FundDebateData['synthesis'] = {
        recommendation: synthesisParsed?.recommendation || 'hold',
        conviction: Math.min(100, Math.max(30, Number(synthesisParsed?.conviction ?? 65))),
        keyFactors: synthesisParsed?.keyFactors?.slice(0, 8) || ['多空观点均有依据，需结合风险承受能力动态调整。'],
        timeHorizon: synthesisParsed?.timeHorizon || '6-12个月',
        summary: safeMarkdown(synthesisParsed?.summary),
      };

      const debateData: FundDebateData = {
        bullCase: {
          thesis: latestOptimistic,
          catalysts: bullCatalysts.length > 0 ? bullCatalysts : ['政策与流动性', '基本面边际改善', '估值修复'],
          confidence: Math.min(100, Math.max(30, bullConfidence)),
        },
        bearCase: {
          thesis: latestPessimistic,
          risks: bearRisks.length > 0 ? bearRisks : ['宏观扰动', '业绩不确定性', '波动放大'],
          confidence: Math.min(100, Math.max(30, bearConfidence)),
        },
        synthesis,
        evCalculation: synthesisParsed?.evCalculation,
        rounds,
      };

      const confidence = calculateOverallConfidence(debateData);
      debateData.synthesis.conviction = Math.round(confidence * 100);

      const durationMs = Date.now() - startTime;

      logger.info('Fund debate completed', {
        entity,
        rounds: rounds.length,
        finalJudge,
        recommendation: debateData.synthesis.recommendation,
        conviction: debateData.synthesis.conviction,
        bullLength: debateData.bullCase.thesis.length,
        bearLength: debateData.bearCase.thesis.length,
        durationMs,
      });

      onProgress?.({
        type: 'complete',
        step: 20,
        message: `多轮辩论完成: ${debateData.synthesis.recommendation}`,
        eventDetail: {
          eventType: 'complete',
          label: '辩论完成',
          detail: `共 ${rounds.length} 轮 · 建议 ${debateData.synthesis.recommendation}`,
          metadata: {
            rounds: rounds.length,
            recommendation: debateData.synthesis.recommendation,
            conviction: debateData.synthesis.conviction,
            durationMs,
          }
        }
      });

      const gaps: string[] = [];
      if (debateData.bullCase.confidence < 60) gaps.push('看多观点置信度不足');
      if (debateData.bearCase.confidence < 60) gaps.push('看空观点置信度不足');

      return {
        success: true,
        data: debateData,
        confidence,
        completeness: 1.0,
        gaps,
        suggestions: ['已完成多轮辩论，可直接进入最终建议。'],
        metadata: {
          durationMs,
          toolsUsed: ['llm'],
        },
      };
    } catch (error) {
      logger.error('Fund debate failed', {
        entity,
        error: String(error),
      });

      const fallback = generateDefaultOutput(entity);

      // 保留已生成的长文本，避免失败后被短模板覆盖
      if (latestOptimistic) {
        fallback.bullCase.thesis = latestOptimistic;
        fallback.bullCase.catalysts = bullCatalysts.length > 0 ? bullCatalysts : fallback.bullCase.catalysts;
        fallback.bullCase.confidence = Math.max(fallback.bullCase.confidence, bullConfidence);
      }
      if (latestPessimistic) {
        fallback.bearCase.thesis = latestPessimistic;
        fallback.bearCase.risks = bearRisks.length > 0 ? bearRisks : fallback.bearCase.risks;
        fallback.bearCase.confidence = Math.max(fallback.bearCase.confidence, bearConfidence);
      }
      if (rounds.length > 0) {
        fallback.rounds = rounds;
      }

      const errorMessage = String(error);
      const isTimeout =
        errorMessage.includes('TimeoutError') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('Request timed out');

      // 即使超时，也发一条降级裁决，避免前端“等待首轮裁决”卡死
      onProgress?.({
        type: 'round_judge',
        step: 99,
        message: '辩论降级裁决',
        data: {
          round: Math.max(1, rounds.length),
          winner: 'draw',
          shouldContinue: false,
          reason: isTimeout
            ? '裁决阶段请求超时，已降级结束当前辩论。'
            : '辩论过程中发生异常，已降级结束当前辩论。',
        },
        eventDetail: {
          eventType: 'analyze',
          label: '降级裁决',
          detail: isTimeout ? 'Decider 超时，结束辩论' : '执行异常，结束辩论',
          metadata: {
            fallback: true,
            isTimeout,
            rounds: rounds.length,
          }
        }
      });

      return {
        success: true,
        data: fallback,
        confidence: 0.55,
        completeness: 0.7,
        gaps: ['辩论过程部分失败，使用降级结果'],
        suggestions: ['可重试辩论以获取更完整论证。'],
        metadata: {
          durationMs: Date.now() - startTime,
          toolsUsed: ['llm'],
        },
      };
    }
  }
}

export const fundDebateSkill = new FundDebateSkill();
export default fundDebateSkill;
