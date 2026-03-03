# backend/src/models 板块说明

## 板块内容
- `security-event.ts`：安全事件领域类型（`SecurityEvent`、`Severity`、`IncidentStatus`）。

## 边界
- 仅定义类型，不执行 IO 与业务逻辑。

## 对外接口
- `SecurityEvent`：日志标准化后的统一事件结构。
- `Severity`、`IncidentStatus`：核心枚举类型。
