/**
 * 简单的内存速率限制器
 * 基于 IP 地址限制请求频率
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;  // 最大请求数
  windowMs: number;     // 时间窗口（毫秒）
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,      // 10 次请求
  windowMs: 60 * 1000,  // 1 分钟
};

// 内存存储 - 在生产环境应该使用 Redis
const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * 清理过期的条目
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * 检查是否超过速率限制
 * @param identifier 标识符（通常是 IP 地址）
 * @param config 速率限制配置
 * @returns 结果对象，包含是否允许和剩余请求数
 */
export function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
} {
  const { maxRequests, windowMs } = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();

  // 定期清理（简单策略：每 100 次检查清理一次）
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  const entry = rateLimitMap.get(identifier);

  if (!entry || entry.resetTime < now) {
    // 新窗口或窗口已过期
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitMap.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: newEntry.resetTime,
      limit: maxRequests,
    };
  }

  // 窗口内
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      limit: maxRequests,
    };
  }

  entry.count++;

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
    limit: maxRequests,
  };
}

/**
 * 从请求中获取客户端标识符（IP 地址）
 * 支持多种代理情况
 */
export function getClientIdentifier(request: Request): string {
  // 尝试从各种 header 获取真实 IP
  const headers = request.headers;

  // 按优先级尝试不同 header
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    headers.get('x-client-ip') ||
    'unknown';

  return ip;
}

/**
 * 获取速率限制状态（用于响应头）
 */
export function getRateLimitHeaders(result: ReturnType<typeof checkRateLimit>): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
  };
}
