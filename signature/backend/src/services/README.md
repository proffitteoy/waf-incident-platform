# signature/backend/src/services 板块说明

## 板块内容
- `forensics/`：取证文件读取、签名验证、记录管理服务。

## 边界
- 服务层承载业务逻辑，不直接处理 HTTP 协议细节。
- 服务层通过 core 访问数据库与文件系统。

## 对外接口
- `getForensicsRecord(fid)`：查询取证记录。
- `readAndVerifyPcap(pcapPath, expectedSha256)`：读取文件并计算 SHA256 签名。
- `updateForensicsStatus(fid, status, pcapPath, sha256, sizeBytes)`：更新取证记录状态。
- `createForensicsRecord(incidentId, captureWindowStart, captureWindowEnd)`：创建取证记录。

## 关键函数/入口
- `forensics.service.ts`：forensicsService 服务模块。