# backend/src/core 板块说明

## 板块内容
- `config/`：环境变量解析。
- `db/`：PostgreSQL 连接池与查询函数。
- `cache/`：Redis 连接、健康检查、键值读写。
- `http/`：HTTP 错误、异常中间件、查询参数解析。
- `logger.ts`：统一日志输出。

## 边界
- 只提供基础设施能力，不承载具体业务规则。
- 所有业务层通过这里访问数据库与缓存。

## 对外接口
- `env`、`pool`、`query`
- `connectRedis`、`closeRedis`、`getRedisHealth`
- `HttpError`、`asyncHandler`、`errorHandler`

## 关键函数
- `db/pool.ts`：`query()`
- `cache/redis.ts`：`setRedisJson()`、`delRedisKey()`
- `http/query-utils.ts`：`parseRangeToHours()`、`parseLimit()`、`parseOffset()`
