import { describe, it, expect, vi, beforeEach } from "vitest";
import { fundDebateSkill } from "./fund-debate";
import { getLLMInstance } from "@/lib/llm/client";
import { FundDeepSearchData } from "../types";

vi.mock("@/lib/llm/client", () => ({
  getLLMInstance: vi.fn(),
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
    const debateOutput = {
      bullCase: {
        thesis: "Bullish thesis",
        catalysts: ["Catalyst A"],
        confidence: 70,
      },
      bearCase: {
        thesis: "Bearish thesis",
        risks: ["Risk A"],
        confidence: 60,
      },
      synthesis: {
        recommendation: "buy",
        conviction: 65,
        keyFactors: ["Factor A"],
        timeHorizon: "6-12 months",
        summary: "Balanced view",
      },
    };

    vi.mocked(getLLMInstance).mockResolvedValueOnce({
      invoke: vi.fn(async () => ({ content: JSON.stringify(debateOutput) })),
    } as any);

    const output = await fundDebateSkill.execute({
      entity: "Gold Fund",
      researchData: buildResearchData(),
    });

    expect(output.success).toBe(true);
    expect(output.data.bullCase.thesis).toBe("Bullish thesis");
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.data.synthesis.summary).toBe("Balanced view");
  });

  it("falls back to defaults when parsing fails", async () => {
    vi.mocked(getLLMInstance).mockResolvedValueOnce({
      invoke: vi.fn(async () => ({ content: "not json" })),
    } as any);

    const output = await fundDebateSkill.execute({
      entity: "Gold Fund",
      researchData: buildResearchData(),
    });

    expect(output.success).toBe(true);
    expect(output.data.synthesis.recommendation).toBe("info_only");
    expect(output.gaps).toContain("看多观点置信度不足");
  });
});
