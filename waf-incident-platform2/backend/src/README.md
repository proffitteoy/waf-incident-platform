# backend/src 板块说明

## 板块内容
- `api/`：HTTP 与 MCP 路由层。
- `core/`：配置、数据库、Redis、HTTP 基础能力。
- `models/`：领域类型定义。
- `services/`：解析、LLM、策略缓存等业务服务。
- `app.ts`：Express 应用装配。
- `server.ts`：进程启动与优雅退出。

## 边界
- 本目录只负责应用层与业务编排。
- 不直接承载 WAF 引擎实现与规则执行。
- 不在路由中重复实现底层协议与数据库驱动细节。

## 对外接口
- HTTP：`/health`、`/api/*`。
- MCP：`/api/mcp/tools`、`/api/mcp/invoke`。

## 关键入口与函数
- `server.ts`：`bootstrap()`。
- `app.ts`：`app` 实例与中间件装配。
- `api/router.ts`：`apiRouter` 路由聚合。
