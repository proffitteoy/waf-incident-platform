# backend/src/services/llm 板块说明

## 板块内容
- `incident-analyzer.ts`：MVP 直连 LLM API 完成事件分析。

## 边界
- 只负责调用外部 LLM 与结果校验。
- 不在此层直接写数据库。

## 对外接口
- `analyzeIncidentWithLlmApi(input)`：返回结构化分析（标题、摘要、严重度、攻击链、建议等）。

## 关键函数
- `llmIncidentAnalysisSchema`：约束 LLM 输出结构。
- `llmIncidentAnalysisEnvelopeSchema`：兼容 `{ data: ... }` 包装格式。
