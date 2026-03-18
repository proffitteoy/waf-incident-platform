# signature/backend/src/core 板块说明

## 板块内容
- `config/`：环境变量配置（env.ts）。
- `db/`：PostgreSQL 连接池（pool.ts）。
- `http/`：HTTP 基础能力（async-handler、http-error 等）。
- `logger.ts`：日志模块。

## 边界
- 核心层提供基础设施能力，不包含业务逻辑。
- 被 services 和 api 层依赖。

## 对外接口
- `env`：环境变量配置对象。
- `query()`：数据库查询函数。
- `closePool()`：关闭数据库连接池。
- `testConnection()`：测试数据库连接。
- `logger`：日志记录对象（info/warn/error/debug）。
- `asyncHandler()`：异步请求处理器。
- `HttpError`：HTTP 错误类。

## 关键函数/入口
- `pool.ts`：query()、closePool()、testConnection()。
- `env.ts`：env 配置对象。
- `logger.ts`：logger 对象。
- `http/async-handler.ts`：asyncHandler 函数。
- `http/http-error.ts`：HttpError 类。