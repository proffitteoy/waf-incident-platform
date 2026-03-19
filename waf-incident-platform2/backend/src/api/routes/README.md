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
- `POST /incidents/:id/actions/request-approval`，`POST /approvals/:id/approve|reject`
- `POST /incidents/:id/forensics/capture`
- `GET /dashboard/overview|timeseries`
- `GET /mcp/tools`，`POST /mcp/invoke`

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
