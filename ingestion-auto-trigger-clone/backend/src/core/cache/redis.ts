import Redis from "ioredis";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || "waf:mvp";

// 删除：const redisConfig = { host: REDIS_HOST, port: REDIS_PORT, db: 0, lazyConnect: true };
const redisConfig = { host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true };

export const redis = new Redis(redisConfig);

export const buildRedisKey = (...segments: string[]): string => {
  return [REDIS_KEY_PREFIX, ...segments].join(":");
};

export const setRedisJson = async (
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> => {
  await redis.set(key, JSON.stringify(value));
  if (ttlSeconds) {
    await redis.expire(key, ttlSeconds);
  }
};

export const delRedisKey = async (key: string): Promise<number> => {
  return await redis.del(key);
};

export const getRedisJson = async <T>(key: string): Promise<T | null> => {
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as T;
};
