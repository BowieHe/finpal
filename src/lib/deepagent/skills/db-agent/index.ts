/**
 * DB Agent Skill
 *
 * 将现有的 db-agent 封装成 DeepAgent Skill，使其成为可调度的数据提供者
 */

import { dbAgent } from "@/lib/agents/db-agent";
import { DBAgentInput, DBAgentTask } from "@/lib/agents/types";
import { createLogger } from "@/lib/logger";
import { SkillInput, SkillOutput } from "../../core/types";
import { ISkill, SkillMetadata } from "../types";

const logger = createLogger("DbAgentSkill");

const METADATA: SkillMetadata = {
  name: "db-agent",
  description: "查询持仓、持仓详情、对比与风险指标等结构化数据库信息",
  triggers: ["持仓", "持仓详情", "数据库", "风险指标"],
  requiredTools: ["db"],
  version: "1.0.0",
};

export interface DbAgentSkillInput extends SkillInput {
  task: DBAgentTask;
  params: DBAgentInput["params"];
}

export class DbAgentSkill implements ISkill {
  readonly metadata = METADATA;

  async execute(input: SkillInput): Promise<SkillOutput> {
    const startTime = Date.now();
    const typedInput = input as DbAgentSkillInput;

    logger.info("Executing db-agent skill", {
      task: typedInput.task,
      params: typedInput.params,
    });

    try {
      const result = await dbAgent({
        task: typedInput.task,
        params: typedInput.params,
        onProgress: (message) => {
          typedInput.onProgress?.(message);
        },
      });

      const durationMs = Date.now() - startTime;
      const success = result.status === "success";

      return {
        success,
        data: result,
        confidence: success ? 0.9 : 0,
        completeness: success ? 1 : 0,
        gaps: success ? [] : ["数据库查询失败"],
        suggestions: success
          ? [`${typedInput.task} 结果已准备`]
          : ["请检查数据库连接"],
        metadata: {
          durationMs,
          toolsUsed: ["db-agent"],
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const err = error instanceof Error ? error.message : String(error);

      logger.error("DbAgentSkill failed", {
        task: typedInput.task,
        error: err,
      });

      return {
        success: false,
        confidence: 0,
        completeness: 0,
        gaps: ["数据库技能执行失败"],
        suggestions: ["请检查配置或稍后重试"],
        error: err,
        metadata: {
          durationMs,
          toolsUsed: ["db-agent"],
        },
      };
    }
  }
}

export const dbAgentSkill = new DbAgentSkill();
export default dbAgentSkill;
