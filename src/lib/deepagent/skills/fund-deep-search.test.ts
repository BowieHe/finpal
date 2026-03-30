import { describe, it, expect, vi, beforeEach } from "vitest";
import { fundDeepSearchSkill } from "./fund-deep-search";
import { batchSearch } from "@/lib/mcp/unified-search";
import { webAgent } from "@/lib/agents/web-agent";

vi.mock("@/lib/mcp/unified-search", () => ({
  batchSearch: vi.fn(),
}));

vi.mock("@/lib/agents/web-agent", () => ({
  webAgent: vi.fn(),
}));

describe("FundDeepSearchSkill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns structured research data when searches succeed", async () => {
    const mockSearchResult = {
      query: "gold news",
      engine: "bailian-websearch",
      results: [
        {
          title: "Gold surprises",
          url: "https://example.com/gold",
          description: "Gold price surges",
        },
      ],
      timestamp: Date.now(),
      reasoning: "success",
      duration: 1200,
    };

    vi.mocked(batchSearch).mockResolvedValueOnce([mockSearchResult]);
    vi.mocked(webAgent).mockResolvedValueOnce({
      agentId: "web-agent",
      task: "fund_info",
      status: "success",
      sources: ["https://example.com/gold"],
      summary: "Detailed fund info",
      query: "gold",
      rawSnippets: [
        {
          title: "snippet",
          url: "https://example.com/snippet",
          content: "fund snippet",
        },
      ],
      durationMs: 200,
    });

    const output = await fundDeepSearchSkill.execute({ entity: "Gold ETF" });

    expect(output.success).toBe(true);
    expect(output.data.searchResults).toEqual([mockSearchResult]);
    expect(output.data.news.length).toBeGreaterThan(0);
    expect(output.data.sources).toContain("https://example.com/gold");
    expect(output.metadata?.sources).toContain("https://example.com/gold");
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.gaps).not.toContain("搜索执行失败");
  });

  it("fails gracefully when batchSearch rejects", async () => {
    vi.mocked(batchSearch).mockRejectedValueOnce(new Error("search down"));

    const output = await fundDeepSearchSkill.execute({ entity: "Gold ETF" });

    expect(output.success).toBe(false);
    expect(output.error).toMatch(/search down/);
    expect(output.confidence).toBe(0);
    expect(output.gaps).toContain("搜索执行失败");
  });
});
