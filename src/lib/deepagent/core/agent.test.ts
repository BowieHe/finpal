import { describe, it, expect, vi } from "vitest";
import { DeepAgent } from "./agent";
import { SkillOutput } from "./types";
import { ISkill } from "../skills/types";
import { dbAgentSchema } from "@/lib/agents/db-agent-schema";

const createStubSkill = (name: string, output: SkillOutput): ISkill => ({
  metadata: { name, description: `${name} stub` },
  execute: vi.fn(async () => output),
});

describe("DeepAgent orchestration", () => {
  it("orchestrates db -> search -> debate flow and emits runtime events", async () => {
    const decisions = [
      {
        thought: "need db",
        decision: "continue" as const,
        nextSkill: "db-agent",
        skillInput: { task: "portfolio_summary", params: {} },
        reason: "collect holdings",
      },
      {
        thought: "need search",
        decision: "continue" as const,
        nextSkill: "fund-deep-search",
        skillInput: { entity: "Gold" },
        reason: "fetch news",
      },
      {
        thought: "need debate",
        decision: "continue" as const,
        nextSkill: "fund-debate",
        skillInput: { entity: "Gold", researchData: {} },
        reason: "analyze",
      },
      {
        thought: "finalize",
        decision: "finalize" as const,
        nextSkill: null,
        skillInput: null,
        reason: "done",
      },
    ];

    const fakeLLM = {
      invoke: vi.fn(async () => {
        const next = decisions.shift();
        return { content: JSON.stringify(next) };
      }),
    };

    const progressEvents: Array<{ type: string }> = [];

    const agent = new DeepAgent({
      llm: fakeLLM as any,
      maxSteps: 6,
      confidenceThreshold: 0.4,
      onProgress: (event) => {
        progressEvents.push({ type: event.type });
      },
    });

    const dbSkill = createStubSkill("db-agent", {
      success: true,
      confidence: 0.95,
      completeness: 1,
      gaps: [],
      data: { holdings: true, schema: dbAgentSchema },
    });

    const searchSkill = createStubSkill("fund-deep-search", {
      success: true,
      confidence: 0.8,
      completeness: 1,
      gaps: [],
      data: {
        searchResults: [
          {
            title: "stat",
            url: "https://example.com",
            description: "result",
          },
        ],
      },
    });

    const debateSkill = createStubSkill("fund-debate", {
      success: true,
      confidence: 0.7,
      completeness: 1,
      gaps: [],
      data: {
        synthesis: {
          recommendation: "hold",
          conviction: 70,
          keyFactors: ["factor"],
          timeHorizon: "6-12 months",
          summary: "summary",
        },
        bullCase: { thesis: "bull", catalysts: [], confidence: 60 },
        bearCase: { thesis: "bear", risks: [], confidence: 50 },
      },
    });

    agent.registerSkill(dbSkill);
    agent.registerSkill(searchSkill);
    agent.registerSkill(debateSkill);

    const result = await agent.execute("Analyze gold", "Gold ETF");

    expect(result.success).toBe(true);
    expect(result.skillsUsed).toEqual(
      expect.arrayContaining(["db-agent", "fund-deep-search", "fund-debate"]),
    );

    const eventTypes = progressEvents.map((event) => event.type);
    expect(eventTypes).toContain("db_query");
    expect(eventTypes).toContain("db_result");
    expect(eventTypes).toContain("searching");
    expect(eventTypes).toContain("search_result");
    expect(eventTypes).toContain("search_complete");
  });
});
