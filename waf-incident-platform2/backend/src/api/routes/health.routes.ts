import { Router, Request, Response } from 'express';
import { pool } from '../../core/db/pool';
import { redisClient } from '../../core/cache/redis';
import { asyncHandler } from '../../core/http/async-handler';

const router = Router();

/**
 * GET /health
 * 返回 postgres 和 redis 的连通状态
 * 文档要求：必须同时检查 PG 和 Redis
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  const healthStatus: any = {
    ok: true,
    service: 'waf-incident-platform',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // 1. 检查 PostgreSQL
  try {
    await pool.query('SELECT 1');
    healthStatus.checks.postgres = 'ok';
  } catch (e) {
    healthStatus.checks.postgres = 'error';
    healthStatus.ok = false;
  }

  // 2. 检查 Redis
  try {
    if (!redisClient.isReady) {
      throw new Error('Redis client not ready');
    }
    await redisClient.ping();
    healthStatus.checks.redis = 'ok';
  } catch (e) {
    healthStatus.checks.redis = 'error';
    healthStatus.ok = false;
  }

  const statusCode = healthStatus.ok ? 200 : 503;
  res.status(statusCode).json(healthStatus);
}));

export { router as healthRouter };