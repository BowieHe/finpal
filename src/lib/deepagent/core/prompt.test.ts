import { describe, it, expect } from "vitest";
import { buildObservationPrompt } from "./prompt";

describe("DeepAgent prompt helpers", () => {
  it("includes DB schema and collaboration hints", () => {
    const context = {
      step: 1,
      goal: "Analyze Gold ETF",
      entity: "Gold ETF",
      actionsCount: 0,
      confidence: 0.5,
      gaps: ["missing drivers"],
      availableSkills: ["db-agent", "fund-deep-search", "fund-debate"],
      dbSchemaSummary: "Tables: user_holdings, fund_nav",
      dbTaskList: ["portfolio_summary: summarizes holdings"],
    } as any;

    const prompt = buildObservationPrompt(context);

    expect(prompt).toContain("DB Agent 任务参考");
    expect(prompt).toContain("工具协作提示");
    expect(prompt).toContain("Tables: user_holdings");
    expect(prompt).toContain("portfolio_summary");
  });
});
