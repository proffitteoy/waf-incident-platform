# backend/src/core/config 板块说明

## 板块内容
- `env.ts`：从环境变量加载后端配置（PostgreSQL、Redis、LLM、存储路径、抓包参数）。

## 边界
- 仅负责配置解析，不做连接与业务逻辑。

## 对外接口
- `env`：全局配置对象。

## 关键字段
- PostgreSQL：`POSTGRES_*`
- Redis：`REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`、`REDIS_DB`、`REDIS_KEY_PREFIX`
- LLM：`LLM_API_URL`、`LLM_API_KEY`、`LLM_MODEL`、`LLM_TIMEOUT_MS`
