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

## 前置依赖条件


建议先检查：

- powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\check-preflight.ps1

### Docker 部署模式（全容器）

必需条件：

1. Windows PowerShell 5.1+（用于执行 scripts 目录下脚本）。
2. Docker Desktop 已运行，且支持 docker compose。
3. 已准备 backend/.env（可由 backend/.env.example 复制）。

端口要求：

1. 80（WAF 网关入口）。
2. 5173（前端）。
3. 3000（后端 API，便于联调直连）。
4. 55432（PostgreSQL 映射）。
5. 6379（Redis）。

建议先检查：

- powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\check-preflight.ps1

说明：

- 本地开发模式建议仅启动 postgres 与 redis 容器，再在宿主机启动 backend/frontend。
- Docker 部署模式会同时启动 frontend/backend/waf/forensics-worker，前端代理目标为容器内 backend:3000。


## Docker Compose 部署（全容器）

适用于联调、演示或验收环境，一条命令启动完整服务栈（postgres/redis/backend/frontend/waf/forensics-worker/ingestion-worker）。

需要在包含 docker-compose.yml目录下运行
1. 复制后端环境变量模板：`copy backend\\.env.example backend\\.env`
2. 在 `backend/.env` 中填写目标防御网站：
   - `WEBSITE_URL=http://host.docker.internal:8080`（示例）
   - 若要防护其他站点，替换为实际上游地址（如 `http://example.internal:8080`）。
   - `waf` 服务会通过 `env_file: ./backend/.env` 注入该变量，`infrastructure/nginx/nginx.conf` 使用 `WEBSITE_URL` 作为反向代理上游。
3. 建议先做启动前检查：`powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\check-preflight.ps1`
4. 全量启动（含构建，首次或变更镜像使用）：`docker compose up -d --build`
5. 查看服务状态：`docker compose ps`
6. 查看后端与自动入库 worker 日志（可选）：`docker compose logs -f backend ingestion-worker`

7. 首次成功后，日常启动不要每次都带 `--build`，使用：`docker compose up -d`

访问入口：
- 前端：http://localhost:5173
- 后端 API：http://localhost:3000

停止与清理：
- 停止容器：`docker compose down`
- 停止并删除数据卷：`docker compose down -v`

## 日志回放与测试

1. 回放日志写入 `events_raw`：
   - `cd backend`
   - `node replay.js tests/logs/sqli.log`
2. 运行单元测试：
   - `npm.cmd test`
3. web-test:
   - web-test文件夹内是用于测试的目标网站，具体的攻击命令和测试方法写在该文件夹下的readme.md
## 文档索引

- 项目目标与约束：`docs/技术细节.md`、`docs/强前置条件约束.md`
- 架构白板（主）：`docs/canvas-dev/project.canvas`
- 后端说明：`backend/README.md`
