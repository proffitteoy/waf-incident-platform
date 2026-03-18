# 系统架构（MVP）

## 文档目的

描述当前已实现形态，不描述未落地的理想架构。

## 架构目标

围绕 OWASP CRS 命中事件构建可审计闭环：

`Logs -> Parser -> Event Store -> LLM API Analyze -> Incident Store -> Policy -> (Auto Action | Approval) -> Actuator -> Redis Action State -> Enforcement Confirm -> Action Log -> Dashboard`

## 分层与边界

1. 入口防护层（外部）
- Nginx/OpenResty
- Coraza/ModSecurity + OWASP CRS
- 输出 JSON 审计日志

2. API 编排层（`backend/src/api`）
- 提供 REST + MCP 入口
- 路由挂载：`backend/src/api/router.ts`
- 不承载复杂业务规则

3. 服务与工具层（`backend/src/services` + `backend/tools`）
- `services/ingestion`：审计日志解析与归一
- `services/llm`：本地 Prompt 渲染、LLM API 调用、输出校验与降级
- `services/policy`：动作状态缓存（Redis）
- `tools/parser.js`：回放日志解析
- `tools/correlator.js`：开发/测试关联逻辑
- `tools/policy-engine.js`：风险评估函数
- `tools/executor.mock.js`：执行器 mock

4. 数据层
- PostgreSQL：事实数据（`events_raw/incidents/actions/approvals/...`）
- Redis：动作状态缓存与计数状态
- `storage/*`：日志、pcap、报告文件

5. 前端展示层（`frontend/src`）
- Vue 3 + Vite 单页应用
- `main.ts`：挂载 Vue 应用
- `App.vue`：根组件
- `pages/DashboardPage.vue`：仪表盘页面编排
- `components/OverviewPanel.vue`：概览卡片展示

## 当前关键实现点

- MVP 不启用独立事件关联引擎服务，分析由 LLM 直连完成。
- `POST /api/incidents/analyze-events` 可从 `events_raw` 生成 `incident + alert + llm_report + audit_log`。
- `backend/src/services/llm/prompt-registry.ts` 当前已落地本地中文 Prompt registry，按 `task + prompt_version` 渲染 Prompt，并生成 `prompt_digest`。
- `backend/src/services/llm/incident-analyzer.ts` 当前已落地真实 LLM API 调用、超时控制、重试、进程内熔断、确定性降级与响应 schema 校验。
- `llm_reports` 与 `audit_logs` 当前会同时记录 `model/task/prompt_version/prompt_digest/input_digest` 等元数据，用于追溯分析链路。
- 动作执行与审批通过后写 Redis 动作状态键；回滚会尝试清理键。
- 健康检查 `GET /health` 同时返回 PostgreSQL 与 Redis 状态。

## 开发测试链路

- 日志回放入口：`backend/replay.js`
- 测试样本：`backend/tests/logs/*.log`
- 单测：`backend/tests/unit/*.test.js`
- LLM stub：`backend/src/services/llm/llmService.stub.ts`

## 架构白板

- 主文件：`docs/canvas-dev/project.canvas`
- 约束：节点与连线必须使用中文。
