import { describe, it, expect, vi, beforeEach } from "vitest";
import { dbAgentSkill } from "./db-agent";
import { dbAgent } from "@/lib/agents/db-agent";
import { dbAgentSchema } from "@/lib/agents/db-agent-schema";

vi.mock("@/lib/agents/db-agent", () => ({
  dbAgent: vi.fn(),
}));

describe("DbAgentSkill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes schema info and success metadata", async () => {
    const payload = {
      agentId: "db-agent" as const,
      task: "portfolio_summary" as const,
      status: "success" as const,
      data: { totalValue: 1234 },
      schema: dbAgentSchema,
      durationMs: 10,
    };

    vi.mocked(dbAgent).mockResolvedValueOnce(payload);

    const output = await dbAgentSkill.execute({
      entity: "Gold",
      task: "portfolio_summary",
      params: {},
    });

    expect(output.success).toBe(true);
    expect(output.data).toEqual(payload);
    expect(output.metadata?.toolsUsed).toContain("db-agent");
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.gaps).toHaveLength(0);
  });

  it("returns failure when dbAgent errors", async () => {
    vi.mocked(dbAgent).mockRejectedValueOnce(new Error("boom"));

    const output = await dbAgentSkill.execute({
      entity: "Gold",
      task: "portfolio_summary",
      params: {},
    });

    expect(output.success).toBe(false);
    expect(output.error).toMatch(/boom/);
    expect(output.gaps).toContain("数据库技能执行失败");
  });
});
