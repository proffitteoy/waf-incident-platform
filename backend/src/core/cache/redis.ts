import { createClient } from "redis";
import { env } from "../config/env";
import { logger } from "../logger";

export const redisClient = createClient({
  socket: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT
  },
  password: env.REDIS_PASSWORD,
  database: env.REDIS_DB
});

redisClient.on("error", (error) => {
  logger.error("redis client error", error instanceof Error ? error.message : error);
});

redisClient.on("ready", () => {
  logger.info("redis client ready");
});

export const connectRedis = async () => {
  if (redisClient.isReady) {
    return;
  }

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    await redisClient.ping();
    logger.info("redis connected", {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      db: env.REDIS_DB
    });
  } catch (error) {
    logger.error("redis connect failed", error instanceof Error ? error.message : error);
    throw error;
  }
};

export const closeRedis = async () => {
  if (!redisClient.isOpen) {
    return;
  }

  await redisClient.quit();
};

const ensureReady = () => {
  if (!redisClient.isReady) {
    throw new Error("redis is not ready");
  }
};

export const buildRedisKey = (...segments: string[]) => {
  return [env.REDIS_KEY_PREFIX, ...segments].join(":");
};

export const setRedisJson = async (key: string, value: unknown, ttlSeconds?: number) => {
  ensureReady();
  const payload = JSON.stringify(value);

  if (ttlSeconds && ttlSeconds > 0) {
    await redisClient.set(key, payload, { EX: ttlSeconds });
    return;
  }

  await redisClient.set(key, payload);
};

export const delRedisKey = async (key: string): Promise<number> => {
  ensureReady();
  return redisClient.del(key);
};

export const getRedisJson = async <T = unknown>(key: string): Promise<T | null> => {
  ensureReady();
  const raw = await redisClient.get(key);

  if (raw === null) {
    return null;
  }

  return JSON.parse(raw) as T;
};

export const getRedisHealth = () => {
  return {
    connected: redisClient.isReady,
    open: redisClient.isOpen,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB
  };
};
