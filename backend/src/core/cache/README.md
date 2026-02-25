# backend/src/core/cache 板块说明

## 板块内容
- `redis.ts`：Redis 客户端初始化、连接生命周期、健康状态、KV 操作。

## 边界
- 只提供缓存基础能力，不感知业务实体。
- 键规则由业务服务层定义。

## 对外接口
- `connectRedis()`：启动时连接并 `PING` 验证。
- `closeRedis()`：进程退出时关闭连接。
- `getRedisHealth()`：用于健康检查输出。
- `buildRedisKey()`：统一前缀拼接。
- `setRedisJson()`：写入 JSON（可带 TTL）。
- `delRedisKey()`：删除键。

## 关键函数
- `ensureReady()`：强制 Redis 就绪后再执行 KV 操作。
