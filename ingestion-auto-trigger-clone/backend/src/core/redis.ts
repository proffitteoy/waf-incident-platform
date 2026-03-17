import Redis from 'ioredis';
import { logger } from './logger';

export const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
});

redisClient.on('error', (err) => {
  logger.error('[Redis] 连接错误', { error: err.message });
});

redisClient.on('connect', () => {
  logger.info('[Redis] 连接成功');
});

export async function connectRedis() {
  try {
    await redisClient.ping();
    logger.info('[Redis] 健康检查通过');
  } catch (error) {
    logger.error('[Redis] 健康检查失败', { 
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}