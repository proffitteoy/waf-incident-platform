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
- 网关执行确认：`ACTUATOR_CONFIRM_TOKEN`（可选，启用后要求执行确认接口携带校验头）
- LLM 基础：`LLM_API_URL`、`LLM_API_KEY`、`LLM_MODEL`、`LLM_MODEL_VERSION`、`LLM_TIMEOUT_MS`
- LLM Prompt 治理：`LLM_TASK_NAME`、`LLM_PROMPT_VERSION`
- LLM 调用治理：`LLM_MAX_RETRIES`、`LLM_RETRY_BACKOFF_MS`、`LLM_CIRCUIT_BREAKER_THRESHOLD`、`LLM_CIRCUIT_BREAKER_COOLDOWN_MS`、`LLM_FALLBACK_MODE`
- 取证下载签名：`FORENSICS_DOWNLOAD_SECRET`、`FORENSICS_DOWNLOAD_TTL_SECONDS`
