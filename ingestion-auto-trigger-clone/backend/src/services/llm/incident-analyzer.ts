import { pool } from "../../core/database";

interface LlmAnalysisInput {
  eventIds: string[];
  metadata: { src_ip: string; requested_by: string };
  triggerType: "auto" | "manual";
  triggeredAt: string;
}

export const analyzeIncidentWithLlmApi = async (input: LlmAnalysisInput): Promise<unknown> => {
  const { eventIds, metadata, triggerType, triggeredAt } = input;
  
  // 获取事件数据
  const eventsResult = await pool.query(
    `SELECT * FROM events_raw WHERE event_id = ANY($1)`,
    [eventIds]
  );

  // 调用 LLM API（实际实现）

  return {
    incident: { id: "inc_123", title: "Analysis Result" },
    alert: { id: "alert_123" },
    llm_report: { id: "report_123" },
    llm_meta: {
      provider: "llm_api",
      degraded: false,
      attempts: 1,
      retries: 0,
      latency_ms: 100,
      circuit_state: "closed",
      task: "waf_incident_analysis_mvp",
      prompt_version: "v1",
      prompt_digest: "digest",
      model: "mock-model",
      model_version: "2026-03-04",
      report_model: "mock-model@2026-03-04#v1",
      input_digest: "input-digest",
      failure_reason: null
    },
    source_events: eventsResult.rows
  };
};