# backend/src/api/routes 板块说明

## 板块内容
- 认证：`auth.routes.ts`
- 事件数据：`events.routes.ts`、`alerts.routes.ts`、`incidents.routes.ts`
- 分析：`llm-reports.routes.ts`、`mcp.routes.ts`
- 执行闭环：`actions.routes.ts`、`approvals.routes.ts`、`forensics.routes.ts`
- 基础配置：`assets.routes.ts`、`policies.routes.ts`
- 采集：`ingestion.routes.ts`
- 观测：`dashboard.routes.ts`

## 边界
- 路由层只处理请求编排和错误返回。
- 不在本层维护跨请求共享可变状态。

## 对外接口
- `POST /auth/login`，`GET /me`
- `GET /events`，`GET /alerts`，`GET /incidents`，`GET /incidents/:id`
- `POST /api/incidents/analyze-events`
- `POST /incidents/:id/actions/execute`，`POST /actions/:id/rollback`
- `POST /actions/enforcement/confirm`（网关生效确认回传）
- `GET /actions/:id/status`（动作执行状态）
- `GET /incidents/:id/actions/timeline`（事件动作时间线）
- `POST /incidents/:id/actions/request-approval`，`POST /approvals/:id/approve|reject`
- `POST /incidents/:id/forensics/capture`
- `GET /incidents/:id/forensics`
- `GET /forensics/:fid/download`
- `GET /forensics/:fid/file?token=...`
- `GET /dashboard/overview|timeseries`
- `GET /mcp/tools`，`POST /mcp/invoke`

动作确认说明：
- `POST /actions/enforcement/confirm` 需要携带 `action_id` 与命中信息（如 `http_status`、`scope`、`action_type`）。
- 若启用 `ACTUATOR_CONFIRM_TOKEN`，请求头需包含 `X-Actuator-Token`。

取证说明：
- `capture` 仅创建任务并返回 `queued`，实际抓包由 worker 异步执行。
- `download` 仅在 `completed` 状态签发短时下载地址。

## 关键导出
- `authRouter`
- `eventsRouter`
- `alertsRouter`
- `incidentsRouter`
- `llmReportsRouter`
- `actionsRouter`
- `approvalsRouter`
- `forensicsRouter`
- `dashboardRouter`
- `assetsRouter`
- `policiesRouter`
- `ingestionRouter`
- `mcpRouter`
