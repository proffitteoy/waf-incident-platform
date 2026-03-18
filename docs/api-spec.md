# REST API 契约（MVP）

## 说明

- 基础前缀：`/api`（`/health` 除外）。
- 本文仅记录当前代码已挂载接口。

## 健康检查

- `GET /health`
  - 返回：`ok/postgres/redis` 状态。

## 认证

- `POST /api/auth/login`
- `GET /api/me`

## 日志采集

- `POST /api/ingestion/coraza/audit-lines`
  - 用途：接收 Coraza JSON 审计日志并写入 `events_raw`。

## 仪表盘

- `GET /api/dashboard/overview?range=1h|24h|7d`
- `GET /api/dashboard/timeseries?metric=alerts|blocks|requests&range=...`

## 事件、告警、事件单

- `GET /api/events`
- `GET /api/alerts`
- `GET /api/incidents`
- `GET /api/incidents/:id`
- `POST /api/incidents/:id/comment`
- `POST /api/incidents/analyze-events`
- `GET /api/incidents/:id/llm-reports`
- `POST /api/incidents/:id/llm-reports`

说明：
- `analyze-events` 由 `llm-reports.routes.ts` 提供，但通过 `/api/incidents` 前缀对外暴露。
- `POST /api/incidents/analyze-events` 当前返回：`incident`、`alert`、`llm_report`、`llm_meta`、`source_events`。
- `llm_meta` 当前包含：`provider`、`degraded`、`attempts`、`retries`、`latency_ms`、`circuit_state`、`task`、`prompt_version`、`prompt_digest`、`model`、`model_version`、`report_model`、`input_digest`、`failure_reason`。
- `GET /api/incidents/:id` 与 `GET /api/incidents/:id/llm-reports` 返回的 `llm_reports` 当前包含：`model`、`task`、`prompt_version`、`prompt_digest`、`input_digest` 以及分析结果字段。
- `POST /api/incidents/:id/llm-reports` 当前允许手工写入：`model`、`task`、`prompt_version`、`prompt_digest`、`input_digest`、`attack_chain`、`key_iocs`、`risk_assessment`、`recommended_actions_low`、`recommended_actions_high`、`confidence`。

## 处置与审批

- `POST /api/incidents/:id/actions/execute`
- `POST /api/incidents/:id/actions/request-approval`
- `GET /api/approvals?status=pending`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `POST /api/actions/:id/rollback`
- `POST /api/actions/enforcement/confirm`
- `GET /api/actions/:id/status`
- `GET /api/incidents/:id/actions/timeline`

约束：
- 执行动作必须写入 `actions` 表。
- 回滚动作也作为独立动作写入 `actions` 表。
- 动作响应需返回 `execution_state`，语义包含：`requested/dispatched/effective/expired/rolled_back/failed`。
- 网关执行器命中后应调用 `POST /api/actions/enforcement/confirm` 回传 `action_id` 与命中信息，用于推进 `effective` 状态。
- 若配置 `ACTUATOR_CONFIRM_TOKEN`，网关回传需携带请求头 `X-Actuator-Token`。

## 取证

- `POST /api/incidents/:id/forensics/capture`
- `GET /api/incidents/:id/forensics`
- `GET /api/forensics/:fid/download`
- `GET /api/forensics/:fid/file?token=...`

约束：
- `capture` 为异步任务入口，初始状态为 `queued`。
- worker 会将状态推进为 `capturing -> completed|failed`。
- `download` 在 `status != completed` 时返回 `409`。
- `download` 在 `completed` 时返回短时签名下载地址 `download_url` 与 `expires_at`。
- `file` 接口需校验签名 token，校验通过后返回 pcap 文件流。

## 策略与资产

- `GET /api/policies`
- `PUT /api/policies/:id`
- `GET /api/assets`
- `POST /api/assets`

## MCP 网关

- `GET /api/mcp/tools`
- `POST /api/mcp/invoke`
