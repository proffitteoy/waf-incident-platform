# backend/src/services/llm 板块说明

## 文档目的
- 说明 LLM 模块的当前实现边界、治理能力与变更影响。

## 板块内容
- `llm-contract.ts`：LLM 分析输入数据结构定义。
- `prompt-registry.ts`：本地 Prompt registry，负责按 `task + prompt_version` 渲染中文 Prompt 并计算 `prompt_digest`。
- `incident-analyzer.ts`：封装真实 LLM API 调用、重试、进程内熔断、确定性降级、schema 校验与调用元数据输出。

## 边界
- 负责本地 Prompt 组装、外部 LLM 调用控制、结果结构校验与调用元数据生成。
- 不在此层直接写数据库；持久化由路由层完成。
- 当前熔断状态仅保存在单进程内存中，不做跨实例共享。

## 当前实现状态
- 已实现本地中文 Prompt 渲染，并将 `prompt`、`prompt_version`、`prompt_digest` 随请求一起下发到上游 LLM API。
- 已实现超时控制、重试退避、进程内熔断与确定性降级。
- 已使用 `llmIncidentAnalysisSchema` 与 `llmIncidentAnalysisEnvelopeSchema` 校验输出结构。
- 已输出 `provider/degraded/attempts/retries/latency_ms/task/prompt_version/prompt_digest/model/model_version/report_model/input_digest/failure_reason` 等调用元数据。
- 当前未提供 Prompt registry 管理接口、灰度切换与专门单测。

## 对外接口
- `analyzeIncidentWithLlmApi(input)`：返回 `{ analysis, meta }`，其中 `analysis` 为结构化分析结果，`meta` 为调用治理元数据。
- `renderPrompt(task, version, input)`：从本地 Prompt registry 渲染 Prompt，并返回 Prompt 内容与 `prompt_digest`。

## 关键函数
- `renderPrompt()`：按 `task + prompt_version` 解析本地 Prompt 定义。
- `attemptLlmAnalysis()`：执行带重试的 LLM 调用。
- `buildFallbackAnalysis()`：在上游失败或熔断打开时生成确定性降级结果。

## 变更影响
- `POST /api/incidents/analyze-events` 与 MCP `analyze_incident` 的返回结果、审计日志、`llm_reports` 均会携带 Prompt/模型版本元数据。
- 如需切换 Prompt 内容，必须同步调整本目录下的 Prompt registry 与 `LLM_PROMPT_VERSION`。
