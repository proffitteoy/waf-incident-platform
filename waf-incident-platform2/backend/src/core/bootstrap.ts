import { pool } from './db/pool';
import { redisClient } from './cache/redis';

/**
 * 启动前预检
 * 文档要求：后端启动前显式检查 Redis 连通性，失败则服务不启动
 */
export async function runStartupChecks(): Promise<void> {
  console.log('[bootstrap] running startup checks...');

  // 1. Check PostgreSQL
  try {
    await pool.query('SELECT 1');
    console.log('[bootstrap] postgres: ok');
  } catch (e) {
    console.error('[bootstrap] postgres: failed', e);
    throw new Error('PostgreSQL connection failed');
  }

  // 2. Check Redis
  try {
    if (!redisClient.isReady) {
      await redisClient.connect();
    }
    await redisClient.ping();
    console.log('[bootstrap] redis: ok');
  } catch (e) {
    console.error('[bootstrap] redis: failed', e);
    throw new Error('Redis connection failed');
  }

  console.log('[bootstrap] all checks passed');
}