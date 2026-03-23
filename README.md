# WAF 事件闭环平台（MVP）

目标链路：
`Logs -> Parser -> Event Store -> LLM API Analyze -> Incident Store -> Policy -> (Auto Action | Approval) -> Actuator -> Action Log -> Dashboard`

## 当前状态（2026-02-25）

- 已采用 **LLM API 直分析**，MVP 不启用事件关联引擎服务。
- 已启用 Redis，后端启动前会显式检查 Redis 连通性。
- 已落地日志回放与测试基础设施：
  - `backend/replay.js`
  - `backend/tools/parser.js`
  - `backend/tools/correlator.js`
  - `backend/tools/policy-engine.js`
  - `backend/tools/executor.mock.js`
  - `backend/src/services/llm/llmService.stub.ts`
  - `backend/tests/logs/*.log`
  - `backend/tests/unit/*.test.js`

## 技术栈

- 入口防护：Nginx/OpenResty + Coraza/ModSecurity + OWASP CRS
- 后端：Node.js + TypeScript + Express
- 存储：PostgreSQL + Redis + 本地文件（`storage/*`）
- 前端：Vue 3 + Vite
- 取证：tshark（由 worker 触发）
- 分析：LLM API（MVP 直连）

## 目录结构

```text
waf-incident-platform/
|-- frontends/
|-- backend/
|   |-- src/
|   |-- tools/
|   |-- tests/
|   |   |-- logs/
|   |   `-- unit/
|   `-- replay.js
|-- infrastructure/
|-- services/
|-- scripts/
`-- storage/
```

## 快速启动（本地开发）

1. 复制后端环境变量模板：`copy backend\\.env.example backend\\.env`
2. 启动依赖：`docker compose up -d postgres redis`
   - 说明：为避免与本机 PostgreSQL 冲突，Compose 将 PostgreSQL 映射到宿主机 `55432` 端口。
   - 本地运行后端时，请确保 `backend/.env` 中 `POSTGRES_PORT=55432`。
3. 启动后端：
   - `cd backend`
   - `npm.cmd install`
   - `npm.cmd run dev`
4. 可选启动前端：
   - `cd frontends`
   - `npm.cmd install`
   - `npm.cmd run dev`

## Docker Compose 部署（全容器）

适用于联调、演示或验收环境，一条命令启动完整服务栈（postgres/redis/backend/frontend/waf/forensics-worker）。

需要在包含 docker-compose.yml目录下运行
1. 复制后端环境变量模板：`copy backend\\.env.example backend\\.env`
2. 建议先做启动前检查：`powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\check-preflight.ps1`
3. 全量启动（含构建，首次或变更镜像使用）：`docker compose up -d --build`
4. 查看服务状态：`docker compose ps`
5. 查看后端日志（可选）：`docker compose logs -f backend`

6.首次成功后，日常启动不要每次都带 --build，
用 docker compose up -d

访问入口：
- 前端：http://localhost:5173
- 后端 API：http://localhost:3000
- WAF 网关：http://localhost:80

停止与清理：
- 停止容器：`docker compose down`
- 停止并删除数据卷：`docker compose down -v`

## 日志回放与测试

1. 回放日志写入 `events_raw`：
   - `cd backend`
   - `node replay.js tests/logs/sqli.log`
2. 运行单元测试：
   - `npm.cmd test`

## 文档索引

- 项目目标与约束：`docs/技术细节.md`、`docs/强前置条件约束.md`
- 架构白板（主）：`docs/canvas-dev/project.canvas`
- 后端说明：`backend/README.md`
