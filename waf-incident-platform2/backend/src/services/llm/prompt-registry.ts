import { createHash } from "crypto";
import type { AnalyzeIncidentInput, LlmEventInput } from "./llm-contract";

interface PromptDefinition {
  task: string;
  version: string;
  render: (input: AnalyzeIncidentInput) => string;
}

export interface RenderedPrompt {
  task: string;
  version: string;
  prompt: string;
  prompt_digest: string;
}

const outputContract = [
  "{",
  '  "title": "string",',
  '  "summary": "string",',
  '  "severity": "low|med|high",',
  '  "attack_chain": [{"stage": "string", "detail": "string"}],',
  '  "key_iocs": [{"type": "string", "value": "string|array|object"}],',
  '  "risk_assessment": {"summary": "string", "rationale": "string"},',
  '  "recommended_actions_low": ["string"],',
  '  "recommended_actions_high": ["string"],',
  '  "confidence": 0-100',
  "}"
].join("\n");

const formatEvent = (event: LlmEventInput, index: number): string => {
  const fields = [
    `#${index + 1}`,
    `ts=${event.ts}`,
    `src_ip=${event.src_ip ?? "null"}`,
    `method=${event.method ?? "null"}`,
    `uri=${event.uri ?? "null"}`,
    `status=${event.status ?? "null"}`,
    `rule_id=${event.rule_id ?? "null"}`,
    `rule_msg=${event.rule_msg ?? "null"}`,
    `rule_score=${event.rule_score ?? "null"}`,
    `waf_action=${event.waf_action ?? "null"}`
  ];

  return fields.join(" | ");
};

const renderIncidentAnalysisPromptV1 = (input: AnalyzeIncidentInput): string => {
  const eventLines = input.events.map((event, index) => formatEvent(event, index)).join("\n");

  return [
    "你是一名资深 WAF 事件分析师。",
    "请分析给定的 WAF 事件，并且只返回 JSON。",
    "不要输出 Markdown 代码块、解释性文字、补充说明或 schema 之外的字段。",
    "只能依据输入中的证据进行判断；如果证据不足，请降低 confidence，不要臆造攻击链。",
    "",
    "必须严格遵循以下 JSON 结构：",
    outputContract,
    "",
    "严重度判断准则：",
    "- high：存在多个利用迹象、重复高分规则命中，或已经形成较清晰的攻击推进过程。",
    "- med：存在明显可疑行为，需要进入人工研判，但尚不足以确认高危攻击链。",
    "- low：仅有较弱、零散或单点可疑信号。",
    "",
    "上下文：",
    `requested_by=${input.requested_by}`,
    `asset_id=${input.asset_id ?? "null"}`,
    `src_ip=${input.src_ip ?? "null"}`,
    `event_count=${input.events.length}`,
    "",
    "事件列表：",
    eventLines
  ].join("\n");
};

const promptRegistry: Record<string, Record<string, PromptDefinition>> = {
  waf_incident_analysis_mvp: {
    v1: {
      task: "waf_incident_analysis_mvp",
      version: "v1",
      render: renderIncidentAnalysisPromptV1
    }
  }
};

export const renderPrompt = (
  task: string,
  version: string,
  input: AnalyzeIncidentInput
): RenderedPrompt => {
  const definition = promptRegistry[task]?.[version];

  if (!definition) {
    throw new Error(`prompt not found for task=${task} version=${version}`);
  }

  const prompt = definition.render(input);
  const prompt_digest = createHash("sha256").update(prompt).digest("hex");

  return {
    task: definition.task,
    version: definition.version,
    prompt,
    prompt_digest
  };
};
