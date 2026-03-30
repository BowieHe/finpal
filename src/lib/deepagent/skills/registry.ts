/**
 * Skill 注册表
 * 
 * 管理所有可用的 Skills，提供注册和获取功能
 */

import { ISkill, SkillMetadata } from './types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SkillRegistry');

/**
 * Skill 注册表类
 */
export class SkillRegistry {
  private skills: Map<string, ISkill> = new Map();
  private metadata: Map<string, SkillMetadata> = new Map();

  /**
   * 注册 Skill
   */
  register(skill: ISkill): void {
    const { name } = skill.metadata;
    
    if (this.skills.has(name)) {
      logger.warn(`Skill ${name} already registered, overwriting`);
    }
    
    this.skills.set(name, skill);
    this.metadata.set(name, skill.metadata);
    
    logger.info(`Skill registered: ${name}`);
  }

  /**
   * 批量注册 Skills
   */
  registerMany(skills: ISkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * 获取 Skill
   */
  get(name: string): ISkill | undefined {
    return this.skills.get(name);
  }

  /**
   * 获取 Skill 元数据
   */
  getMetadata(name: string): SkillMetadata | undefined {
    return this.metadata.get(name);
  }

  /**
   * 获取所有已注册的 Skill 名称
   */
  getAllNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * 获取所有 Skill 元数据
   */
  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * 检查 Skill 是否已注册
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * 移除 Skill
   */
  unregister(name: string): boolean {
    const existed = this.skills.has(name);
    this.skills.delete(name);
    this.metadata.delete(name);
    
    if (existed) {
      logger.info(`Skill unregistered: ${name}`);
    }
    
    return existed;
  }

  /**
   * 清空所有 Skills
   */
  clear(): void {
    this.skills.clear();
    this.metadata.clear();
    logger.info('All skills cleared');
  }

  /**
   * 获取 Skill 数量
   */
  get size(): number {
    return this.skills.size;
  }
}

/**
 * 默认 Skill 注册表实例
 */
export const skillRegistry = new SkillRegistry();
