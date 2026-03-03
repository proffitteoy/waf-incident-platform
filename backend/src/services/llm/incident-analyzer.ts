import { z } from "zod";
import { env } from "../../core/config/env";
import { HttpError } from "../../core/http/http-error";

export interface LlmEventInput {
  id: number;
  ts: string;
  asset_id: string | null;
  src_ip: string | null;
  method: string | null;
  uri: string | null;
  status: number | null;
  rule_id: string | null;
  rule_msg: string | null;
  rule_score: number | null;
  waf_action: string | null;
}

export interface AnalyzeIncidentInput {
  requested_by: string;
  asset_id: string | null;
  src_ip: string | null;
  events: LlmEventInput[];
}

const llmIncidentAnalysisSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: z.enum(["low", "med", "high"]),
  attack_chain: z.array(z.record(z.any())).default([]),
  key_iocs: z.array(z.record(z.any())).default([]),
  risk_assessment: z.record(z.any()).default({}),
  recommended_actions_low: z.array(z.string()).default([]),
  recommended_actions_high: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(100).optional()
});

const llmIncidentAnalysisEnvelopeSchema = z.object({
  data: llmIncidentAnalysisSchema
});

export type LlmIncidentAnalysis = z.infer<typeof llmIncidentAnalysisSchema>;

export const analyzeIncidentWithLlmApi = async (
  input: AnalyzeIncidentInput
): Promise<LlmIncidentAnalysis> => {
  if (!env.LLM_API_URL) {
    throw new HttpError(503, "LLM API 未配置，请设置 LLM_API_URL");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.LLM_TIMEOUT_MS);

  try {
    const response = await fetch(env.LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.LLM_API_KEY ? { Authorization: `Bearer ${env.LLM_API_KEY}` } : {})
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        task: "waf_incident_analysis_mvp",
        input
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new HttpError(502, `LLM API 调用失败: ${response.status}`);
    }

    const payload: unknown = await response.json();
    const direct = llmIncidentAnalysisSchema.safeParse(payload);
    if (direct.success) {
      return direct.data;
    }

    const wrapped = llmIncidentAnalysisEnvelopeSchema.safeParse(payload);
    if (wrapped.success) {
      return wrapped.data.data;
    }

    throw new HttpError(502, "LLM API 返回格式不符合预期");
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(504, "LLM API 请求超时");
    }

    throw new HttpError(502, "LLM API 请求异常");
  } finally {
    clearTimeout(timeout);
  }
};
