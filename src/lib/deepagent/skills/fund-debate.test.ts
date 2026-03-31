import { describe, it, expect, vi, beforeEach } from "vitest";
import { fundDebateSkill } from "./fund-debate";
import { getLLMInstance } from "@/lib/llm/client";
import { FundDeepSearchData } from "./types";

vi.mock("@/lib/llm/client", () => ({
  getLLMInstance: vi.fn(),
  streamWithCallback: vi.fn(async (prompt: string, onChunk: (chunk: string) => void, _maxRetries: number, llm: any) => {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);
    onChunk(content);
    return content;
  }),
}));

const buildResearchData = (): FundDeepSearchData => ({
  fundInfo: { name: "Gold Fund", code: "000999" },
  news: [],
  risks: [],
  sources: [],
  searchQueries: [],
});

describe("FundDebateSkill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses structured LLM output when available", async () => {
    vi.mocked(getLLMInstance).mockResolvedValueOnce({
      invoke: vi
        .fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({
            content: "## 看多结论\n\nBullish thesis",
            catalysts: ["Catalyst A"],
            confidence: 70,
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            content: "## 看空结论\n\nBearish thesis",
            risks: ["Risk A"],
            confidence: 60,
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            winner: "draw",
            shouldContinue: false,
            reason: "首轮先保留分歧",
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            content: "## 多头补充\n\nBullish thesis round 2",
            confidence: 72,
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            content: "## 空头补充\n\nBearish thesis round 2",
            confidence: 61,
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            winner: "optimistic",
            shouldContinue: false,
            reason: "边际信息已经够了",
          }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            recommendation: "buy",
            conviction: 68,
            keyFactors: ["Factor A", "Factor B", "Factor C"],
            timeHorizon: "6-12 months",
            summary: "## Balanced view\n\n整体偏多，但需要控制仓位。",
          }),
        }),
    } as any);

    const output = await fundDebateSkill.execute({
      entity: "Gold Fund",
      researchData: buildResearchData(),
    });

    expect(output.success).toBe(true);
    expect(output.data.bullCase.thesis).toContain("Bullish thesis round 2");
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.data.synthesis.recommendation).toBe("buy");
    expect(output.data.synthesis.summary).toContain("Balanced view");
    expect(output.data.rounds).toHaveLength(2);
  });

  it("falls back to defaults when parsing fails", async () => {
    vi.mocked(getLLMInstance).mockRejectedValueOnce(new Error("llm unavailable"));

    const output = await fundDebateSkill.execute({
      entity: "Gold Fund",
      researchData: buildResearchData(),
    });

    expect(output.success).toBe(true);
    expect(output.data.synthesis.recommendation).toBe("info_only");
    expect(output.data.bullCase.thesis).toContain("Gold Fund");
  });
});
