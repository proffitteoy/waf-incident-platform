# backend/src/services/ingestion 板块说明

## 板块内容
- `coraza-audit.parser.ts`：将 Coraza JSON 审计行解析为 `SecurityEvent[]`。
- `normalize.ts`：将通用原始日志映射为 `SecurityEvent`。

## 边界
- 只做解析和字段归一化，不做落库与策略判定。

## 对外接口
- `parseCorazaAuditJsonLine(line)`
- `normalizeWafLog(raw)`

## 关键函数
- `parseScore()`：从 details.data 提取异常分。
- `normalizeTimestamp()`：容错时间戳规范化。
