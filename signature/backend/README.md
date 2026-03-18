# signature/backend 板块说明

## 板块内容
- `src/api/`：HTTP 路由层，包含 forensics 取证相关路由。
- `src/core/`：配置、数据库、HTTP 基础能力。
- `src/services/`：取证业务服务（forensics.service.ts）。
- `src/app.ts`：Express 应用装配。
- `src/server.ts`：进程启动与优雅退出。

## 边界
- 本目录只负责应用层与业务编排。
- 不直接承载 WAF 引擎实现与规则执行。
- 不在路由中重复实现底层协议与数据库驱动细节。

## 对外接口
- HTTP：`/health`、`/api/forensics/*`。
- 数据库：PostgreSQL（forensics 表）。

## 关键入口与函数
- `server.ts`：`bootstrap()` 启动入口。
- `app.ts`：`app` 实例与中间件装配。
- `api/router.ts`：`apiRouter` 路由聚合。
- `api/routes/forensics.routes.ts`：取证路由（capture/download/meta）。
- `services/forensics/forensics.service.ts`：取证服务（创建/查询/更新/文件读取）。

## 快速启动
1. 复制环境变量：`copy ..\\.env.example .env`
2. 安装依赖：`npm install`
3. 启动开发服务：`npm run dev`
4. 构建生产版本：`npm run build` + `npm start`