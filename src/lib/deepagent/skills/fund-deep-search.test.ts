import { describe, it, expect, vi, beforeEach } from "vitest";
import { fundDeepSearchSkill } from "./fund-deep-search";
import { smartSearch } from "@/lib/mcp/unified-search";
import { webAgent } from "@/lib/agents/web-agent";

vi.mock("@/lib/mcp/unified-search", () => ({
  smartSearch: vi.fn(),
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
      engine: "bailian-websearch" as const,
      results: [
        {
          title: "Gold surprises",
          url: "https://example.com/gold",
          description: "Gold price surges after stronger-than-expected global safe-haven demand.",
        },
      ],
      timestamp: Date.now(),
      reasoning: "success",
      duration: 1200,
    };

    vi.mocked(smartSearch).mockResolvedValueOnce(mockSearchResult);
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
    expect(output.data.searchResults).toHaveLength(1);
    expect(output.data.searchResults[0].query).toContain("Gold ETF");
    expect(output.data.news.length).toBeGreaterThan(0);
    expect(output.data.sources).toContain("https://example.com/gold");
    expect(output.metadata?.sources).toContain("https://example.com/gold");
    expect(output.confidence).toBeGreaterThan(0);
    expect(output.gaps).not.toContain("搜索执行失败");
  });

  it("returns low-confidence output when all searches fail", async () => {
    vi.mocked(smartSearch).mockRejectedValue(new Error("search down"));

    const output = await fundDeepSearchSkill.execute({ entity: "Gold ETF" });

    expect(output.success).toBe(true);
    expect(output.confidence).toBeLessThanOrEqual(0.2);
    expect(output.gaps.length).toBeGreaterThan(0);
    expect(output.suggestions?.join(" ")).toMatch(/继续补充信息|进入分析阶段/);
  });

  it("does not report fund-only gaps for index entities", async () => {
    vi.mocked(smartSearch).mockImplementation(async (query: string) => ({
      query,
      engine: "bailian-websearch" as const,
      results: [
        {
          title: "上证指数走势观察",
          url: "https://example.com/sse",
          description: "上证指数近期走势、成交量与风险因素分析。",
        },
        {
          title: "上证指数投资分析",
          url: "https://example.com/sse-analysis",
          description: "市场表现、估值修复与宏观驱动的综合复盘。",
        },
      ],
      timestamp: Date.now(),
      reasoning: "success",
      duration: 800,
    }));

    const output = await fundDeepSearchSkill.execute({ entity: "上证指数" });

    expect(output.success).toBe(true);
    expect(output.gaps).not.toContain("缺少最新财报数据");
    expect(output.gaps).not.toContain("缺少基金规模/净值信息");
    expect(output.gaps).not.toContain("缺少基金经理信息");
  });
});
