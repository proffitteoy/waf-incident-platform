# backend/src/services 板块说明

## 板块内容
- `ingestion/`：WAF 审计日志解析与标准化。
- `llm/`：调用 LLM API 生成事件分析。
- `policy/`：动作状态缓存（Redis）封装。

## 边界
- 服务层承载业务逻辑，不直接处理 HTTP 协议细节。
- 服务层通过 `core` 访问数据库与缓存基础设施。

## 对外接口
- `parseCorazaAuditJsonLine()`
- `normalizeWafLog()`
- `analyzeIncidentWithLlmApi()`
- `cacheActiveActionState()`、`clearActiveActionState()`
