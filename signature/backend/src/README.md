# signature/backend/src 板块说明

## 板块内容
- `api/`：HTTP 路由层，包含 forensics 等取证相关路由。
- `core/`：配置、数据库、HTTP 基础能力。
- `services/`：取证业务服务（forensics.service.ts）。

## 边界
- 本目录只负责应用层与业务编排。
- 不直接承载 WAF 引擎实现与规则执行。
- 不在路由中重复实现底层协议与数据库驱动细节。

## 对外接口
- HTTP：`/health`、`/api/forensics/*`。

## 关键入口与函数
- `api/routes/forensics.routes.ts`：取证下载路由入口。
- `services/forensics/forensics.service.ts`：取证文件读取与签名验证服务。
- `core/db/pool.ts`：PostgreSQL 连接池。
- `core/config/env.ts`：环境变量配置。