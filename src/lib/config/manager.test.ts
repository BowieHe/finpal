import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  query: vi.fn(),
}));

import { query } from "../db";
import { clearConfigCache, getConfig } from "./manager";

describe("ConfigManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfigCache();
  });

  afterEach(() => {
    clearConfigCache();
  });

  it("uses database config when settings exist", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          api_url: "https://db.example.com/v1",
          model_name: "db-model",
          light_model_name: "db-light",
          api_key: "db-key",
          dashscope_api_key: "db-dashscope",
          updated_at: new Date().toISOString(),
        },
      ],
    } as any);

    const config = await getConfig();

    expect(config.apiKey).toBe("db-key");
    expect(config.apiUrl).toBe("https://db.example.com/v1");
    expect(config.modelName).toBe("db-model");
    expect(config.lightModelName).toBe("db-light");
    expect(config.dashscopeApiKey).toBe("db-dashscope");
  });

  it("falls back to hardcoded defaults when database is empty", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [],
    } as any);

    const config = await getConfig();

    expect(config.apiKey).toBe("");
    expect(config.apiUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
    expect(config.modelName).toBe("qwen-vl-max");
    expect(config.lightModelName).toBeUndefined();
    expect(config.dashscopeApiKey).toBeUndefined();
  });
});
