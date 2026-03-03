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

## 处置与审批

- `POST /api/incidents/:id/actions/execute`
- `POST /api/incidents/:id/actions/request-approval`
- `GET /api/approvals?status=pending`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `POST /api/actions/:id/rollback`

约束：
- 执行动作必须写入 `actions` 表。
- 回滚动作也作为独立动作写入 `actions` 表。

## 取证

- `POST /api/incidents/:id/forensics/capture`
- `GET /api/incidents/:id/forensics`
- `GET /api/forensics/:fid/download`

## 策略与资产

- `GET /api/policies`
- `PUT /api/policies/:id`
- `GET /api/assets`
- `POST /api/assets`

## MCP 网关

- `GET /api/mcp/tools`
- `POST /api/mcp/invoke`
