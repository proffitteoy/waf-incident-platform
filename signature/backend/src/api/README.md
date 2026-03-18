# signature/backend/src/api 板块说明

## 板块内容
- `routes/`：HTTP 路由定义，当前包含 forensics 取证路由。

## 边界
- 路由层只负责请求解析与响应编排。
- 业务逻辑委托给 services 层处理。

## 对外接口
- `GET /api/forensics/:fid/download`：下载 pcap 文件并返回真实 SHA256 签名。
- `GET /api/forensics/:fid/meta`：返回取证记录元数据（不下载文件）。

## 关键函数/入口
- `forensics.routes.ts`：forensicsRouter 路由聚合。