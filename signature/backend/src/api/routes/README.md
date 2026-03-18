# signature/backend/src/api/routes 板块说明

## 板块内容
- `forensics.routes.ts`：取证文件下载与元数据查询路由。

## 边界
- 路由文件不直接访问数据库或文件系统。
- 所有业务操作通过 services 层完成。

## 对外接口
- `GET /api/forensics/:fid/download`：返回 pcap 文件流 + X-SHA256-Signature 响应头。
- `GET /api/forensics/:fid/meta`：返回 JSON 格式取证元数据。

## 关键函数/入口
- `forensicsRouter`：Express 路由实例。
- 依赖服务：`forensicsService.getForensicsRecord()`、`forensicsService.readAndVerifyPcap()`。