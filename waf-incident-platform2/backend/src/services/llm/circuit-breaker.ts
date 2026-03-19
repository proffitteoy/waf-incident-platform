// 核心逻辑骨架

import { redisClient } from '../../core/cache/redis';

const redis = redisClient;
const CIRCUIT_KEY = 'waf:mvp:llm:circuit_breaker';
const FAILURE_COUNT_KEY = 'waf:mvp:llm:failure_count';
const COOLDOWN_MS = parseInt(process.env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS || '60000');
const THRESHOLD = parseInt(process.env.LLM_CIRCUIT_BREAKER_THRESHOLD || '5');

export async function isCircuitOpen(): Promise<boolean> {
  const state = await redis.get(CIRCUIT_KEY);
  if (state === 'open') {
    const cooldownEnd = await redis.get(`${CIRCUIT_KEY}:cooldown_end`);
    if (cooldownEnd && Date.now() < parseInt(cooldownEnd)) {
      return true;
    }
    // 冷却期结束，尝试半开
    await redis.set(CIRCUIT_KEY, 'half-open');
  }
  return false;
}

export async function recordSuccess(): Promise<void> {
  await redis.set(CIRCUIT_KEY, 'closed');
  await redis.del(FAILURE_COUNT_KEY);
}

export async function recordFailure(): Promise<void> {
  const count = await redis.incr(FAILURE_COUNT_KEY);
  await redis.expire(FAILURE_COUNT_KEY, COOLDOWN_MS / 1000);
  
  if (count >= THRESHOLD) {
    await redis.set(CIRCUIT_KEY, 'open');
    await redis.set(`${CIRCUIT_KEY}:cooldown_end`, String(Date.now() + COOLDOWN_MS));
    await redis.expire(CIRCUIT_KEY, COOLDOWN_MS / 1000);
  }
}