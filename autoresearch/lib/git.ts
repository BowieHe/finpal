/**
 * Git 操作封装
 * 
 * 用于 autoResearch 的自动提交和回滚
 */

import { execSync } from 'child_process';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Git');

/**
 * 检查当前目录是否是 git 仓库
 */
export function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取当前 git commit hash
 */
export function getCurrentCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    logger.error('获取当前 commit 失败', { error });
    return 'unknown';
  }
}

/**
 * 检查工作目录是否有未提交的修改
 */
export function hasUncommittedChanges(): boolean {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * 提交当前修改
 */
export async function gitCommit(message: string): Promise<boolean> {
  try {
    if (!hasUncommittedChanges()) {
      logger.info('没有未提交的修改，跳过 commit');
      return true;
    }
    
    execSync('git add -A', { stdio: 'pipe' });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
    
    const commitHash = getCurrentCommit();
    logger.info('Git commit 成功', { commitHash, message });
    
    return true;
  } catch (error) {
    logger.error('Git commit 失败', { error, message });
    return false;
  }
}

/**
 * 回滚到上一个 commit
 */
export async function gitReset(): Promise<boolean> {
  try {
    if (!hasUncommittedChanges()) {
      logger.info('没有未提交的修改，无需回滚');
      return true;
    }
    
    execSync('git reset --hard HEAD', { stdio: 'pipe' });
    logger.info('Git reset 成功，已回滚到 HEAD');
    
    return true;
  } catch (error) {
    logger.error('Git reset 失败', { error });
    return false;
  }
}

/**
 * 回滚到指定 commit
 */
export async function gitResetToCommit(commitHash: string): Promise<boolean> {
  try {
    execSync(`git reset --hard ${commitHash}`, { stdio: 'pipe' });
    logger.info('Git reset 成功', { commitHash });
    return true;
  } catch (error) {
    logger.error('Git reset 失败', { error, commitHash });
    return false;
  }
}

/**
 * 创建新分支
 */
export function createBranch(branchName: string): boolean {
  try {
    execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' });
    logger.info('创建分支成功', { branchName });
    return true;
  } catch (error) {
    logger.error('创建分支失败', { error, branchName });
    return false;
  }
}

/**
 * 切换到分支
 */
export function checkoutBranch(branchName: string): boolean {
  try {
    execSync(`git checkout ${branchName}`, { stdio: 'pipe' });
    logger.info('切换分支成功', { branchName });
    return true;
  } catch (error) {
    logger.error('切换分支失败', { error, branchName });
    return false;
  }
}

/**
 * 获取当前分支名
 */
export function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * 保存当前状态（stash）
 */
export function stashChanges(message?: string): boolean {
  try {
    const cmd = message 
      ? `git stash push -m "${message.replace(/"/g, '\\"')}"`
      : 'git stash push';
    execSync(cmd, { stdio: 'pipe' });
    logger.info('Stash 成功', { message });
    return true;
  } catch (error) {
    logger.error('Stash 失败', { error });
    return false;
  }
}

/**
 * 恢复 stash
 */
export function popStash(): boolean {
  try {
    execSync('git stash pop', { stdio: 'pipe' });
    logger.info('Pop stash 成功');
    return true;
  } catch (error) {
    logger.error('Pop stash 失败', { error });
    return false;
  }
}

/**
 * 获取实验分支名
 */
export function getExperimentBranchName(experimentId: string): string {
  return `autoresearch/${experimentId}`;
}

/**
 * 初始化实验环境
 * 创建实验分支，保存当前工作状态
 */
export function initExperimentEnvironment(experimentId: string): {
  success: boolean;
  originalBranch: string;
  experimentBranch: string;
} {
  const originalBranch = getCurrentBranch();
  const experimentBranch = getExperimentBranchName(experimentId);
  
  try {
    // 保存当前修改
    if (hasUncommittedChanges()) {
      stashChanges(`before-experiment-${experimentId}`);
    }
    
    // 创建并切换到实验分支
    createBranch(experimentBranch);
    
    logger.info('实验环境初始化成功', { originalBranch, experimentBranch });
    
    return {
      success: true,
      originalBranch,
      experimentBranch,
    };
  } catch (error) {
    logger.error('实验环境初始化失败', { error });
    return {
      success: false,
      originalBranch,
      experimentBranch,
    };
  }
}

/**
 * 清理实验环境
 * 切换回原分支，删除实验分支
 */
export function cleanupExperimentEnvironment(
  originalBranch: string,
  experimentBranch: string
): boolean {
  try {
    // 切换回原分支
    checkoutBranch(originalBranch);
    
    // 删除实验分支
    execSync(`git branch -D ${experimentBranch}`, { stdio: 'pipe' });
    
    logger.info('实验环境清理成功', { originalBranch });
    return true;
  } catch (error) {
    logger.error('实验环境清理失败', { error });
    return false;
  }
}
