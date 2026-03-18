# signature/backend/src/services/forensics 板块说明

## 板块内容
- `forensics.service.ts`：取证文件读取、签名验证、记录管理服务。

## 边界
- 只负责取证文件相关的业务逻辑。
- 不负责抓包执行（由 forensics-worker 完成）。
- 不负责审批、策略判定、事件分析。

## 对外接口
- `getForensicsRecord(fid: string)`：从 forensics 表查询记录。
- `readAndVerifyPcap(pcapPath: string, expectedSha256: string | null)`：读取文件、计算签名、验证一致性。
- `updateForensicsStatus(...)`：更新取证记录状态与元数据。
- `createForensicsRecord(...)`：创建新的取证记录。

## 关键函数/入口
- `readAndVerifyPcap()`：核心函数，返回 fileBuffer、sha256、fileSize。