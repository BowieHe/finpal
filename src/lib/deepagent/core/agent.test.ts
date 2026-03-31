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
    expect(eventTypes).toContain("thinking");
    expect(eventTypes).toContain("acting");
    expect(eventTypes).toContain("observing");
    expect(eventTypes).toContain("complete");
  });

  it("only enforces limits on fund-deep-search and finalizes after the configured search budget", async () => {
    const decisions = [
      {
        thought: "search once",
        decision: "continue" as const,
        nextSkill: "fund-deep-search",
        skillInput: { entity: "Gold" },
        reason: "fetch batch 1",
      },
      {
        thought: "search twice",
        decision: "continue" as const,
        nextSkill: "fund-deep-search",
        skillInput: { entity: "Gold" },
        reason: "fetch batch 2",
      },
      {
        thought: "search third time",
        decision: "continue" as const,
        nextSkill: "fund-deep-search",
        skillInput: { entity: "Gold" },
        reason: "fetch batch 3",
      },
    ];

    const fakeLLM = {
      invoke: vi.fn(async () => {
        const next = decisions.shift();
        return { content: JSON.stringify(next) };
      }),
    };

    const agent = new DeepAgent({
      llm: fakeLLM as any,
      searchSkillLimit: 2,
      confidenceThreshold: 0.95,
    });

    const searchSkill = createStubSkill("fund-deep-search", {
      success: true,
      confidence: 0.3,
      completeness: 0.5,
      gaps: ["need more data"],
      data: {
        searchResults: [
          {
            title: "result",
            url: "https://example.com",
            description: "result",
          },
        ],
      },
    });

    agent.registerSkill(searchSkill);

    const result = await agent.execute("Analyze gold", "Gold ETF");
    const searchActions = result.actions.filter((action) => action.skillName === "fund-deep-search");

    expect(result.success).toBe(true);
    expect(searchActions).toHaveLength(2);
    expect(result.totalSteps).toBeLessThanOrEqual(2);
  });
});
