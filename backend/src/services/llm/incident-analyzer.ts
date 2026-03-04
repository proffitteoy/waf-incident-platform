import { createHash } from "crypto";
import { z } from "zod";
import { env } from "../../core/config/env";
import { logger } from "../../core/logger";
import { HttpError } from "../../core/http/http-error";
import type { AnalyzeIncidentInput, LlmEventInput } from "./llm-contract";
import { renderPrompt } from "./prompt-registry";

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

type CircuitState = "closed" | "open" | "half_open";

interface GovernanceMeta {
  task: string;
  prompt_version: string;
  model: string;
  model_version: string;
}

interface AttemptFailure {
  httpStatus: number;
  message: string;
  retryable: boolean;
  attempts?: number;
}

export interface LlmAnalyzeMeta {
  provider: "llm_api" | "fallback";
  fallback_mode: "disabled" | "deterministic";
  degraded: boolean;
  task: string;
  prompt_version: string;
  prompt_digest: string;
  model: string;
  model_version: string;
  report_model: string;
  input_digest: string;
  attempts: number;
  retries: number;
  latency_ms: number;
  circuit_state: CircuitState;
  failure_reason: string | null;
}

export type LlmIncidentAnalysis = z.infer<typeof llmIncidentAnalysisSchema>;

export interface LlmAnalyzeResult {
  analysis: LlmIncidentAnalysis;
  meta: LlmAnalyzeMeta;
}

export type { AnalyzeIncidentInput, LlmEventInput } from "./llm-contract";

const circuit = {
  consecutiveFailures: 0,
  openedAtMs: 0
};

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const getGovernanceMeta = (): GovernanceMeta => ({
  task: env.LLM_TASK_NAME,
  prompt_version: env.LLM_PROMPT_VERSION,
  model: env.LLM_MODEL,
  model_version: env.LLM_MODEL_VERSION
});

const getInputDigest = (input: AnalyzeIncidentInput, governance: GovernanceMeta, promptDigest: string): string => {
  return createHash("sha256")
    .update(
      JSON.stringify({
        task: governance.task,
        prompt_version: governance.prompt_version,
        prompt_digest: promptDigest,
        model: governance.model,
        model_version: governance.model_version,
        input
      })
    )
    .digest("hex");
};

const getCircuitState = (nowMs: number): CircuitState => {
  if (circuit.openedAtMs === 0) {
    return "closed";
  }

  if (nowMs - circuit.openedAtMs >= env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS) {
    return "half_open";
  }

  return "open";
};

const recordCircuitSuccess = (): void => {
  circuit.consecutiveFailures = 0;
  circuit.openedAtMs = 0;
};

const recordCircuitFailure = (): void => {
  circuit.consecutiveFailures += 1;

  if (circuit.consecutiveFailures >= env.LLM_CIRCUIT_BREAKER_THRESHOLD) {
    circuit.openedAtMs = Date.now();
  }
};

const getSeverityFromEvents = (events: LlmEventInput[]): "low" | "med" | "high" => {
  const uniqueRules = new Set(events.map((event) => event.rule_id).filter(Boolean));
  const maxRuleScore = Math.max(0, ...events.map((event) => event.rule_score ?? 0));

  if (uniqueRules.size >= 2 || maxRuleScore >= 8) {
    return "high";
  }

  if (maxRuleScore >= 4 || events.length >= 10) {
    return "med";
  }

  return "low";
};

const buildFallbackAnalysis = (
  input: AnalyzeIncidentInput,
  failureReason: string
): LlmIncidentAnalysis => {
  const severity = getSeverityFromEvents(input.events);
  const topRules = [...new Set(input.events.map((event) => event.rule_id).filter(Boolean))].slice(0, 3);
  const topUris = [...new Set(input.events.map((event) => event.uri).filter(Boolean))].slice(0, 3);
  const srcIp = input.src_ip ?? "unknown";
  const eventCount = input.events.length;
  const maxRuleScore = Math.max(0, ...input.events.map((event) => event.rule_score ?? 0));

  return {
    title: `Fallback analysis for suspicious activity from ${srcIp}`,
    summary:
      `Deterministic fallback was used after LLM analysis failed. ` +
      `Observed ${eventCount} events from ${srcIp} with max rule score ${maxRuleScore}.`,
    severity,
    attack_chain: [
      {
        stage: "ingest",
        detail: `Collected ${eventCount} WAF events for fallback analysis.`
      },
      {
        stage: "classification",
        detail: `Assigned severity ${severity} from rule score and rule diversity.`
      }
    ],
    key_iocs: [
      { type: "src_ip", value: input.src_ip },
      { type: "rule_ids", value: topRules },
      { type: "uris", value: topUris }
    ].filter((item) => {
      if (Array.isArray(item.value)) {
        return item.value.length > 0;
      }

      return Boolean(item.value);
    }),
    risk_assessment: {
      mode: "deterministic_fallback",
      failure_reason: failureReason,
      event_count: eventCount,
      max_rule_score: maxRuleScore,
      rule_ids: topRules,
      uris: topUris
    },
    recommended_actions_low: ["review incident timeline", "monitor repeated requests"],
    recommended_actions_high:
      severity === "high"
        ? ["request approval for temporary block", "capture forensics", "review WAF policy hit context"]
        : ["review repeated requests", "consider short TTL rate limit if activity continues"],
    confidence: 25
  };
};

const buildReportModel = (
  governance: GovernanceMeta,
  provider: "llm_api" | "fallback",
  fallbackMode: "disabled" | "deterministic"
): string => {
  const base = `${governance.model}@${governance.model_version}#${governance.prompt_version}`;

  if (provider === "fallback") {
    return `fallback:${fallbackMode}:${base}`;
  }

  return base;
};

const parseLlmPayload = (payload: unknown): LlmIncidentAnalysis => {
  const direct = llmIncidentAnalysisSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  const wrapped = llmIncidentAnalysisEnvelopeSchema.safeParse(payload);
  if (wrapped.success) {
    return wrapped.data.data;
  }

  throw {
    httpStatus: 502,
    message: "LLM API returned a payload that does not match the expected schema",
    retryable: false
  } satisfies AttemptFailure;
};

const shouldRetryStatus = (status: number): boolean => {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
};

const performLlmRequest = async (
  input: AnalyzeIncidentInput,
  governance: GovernanceMeta,
  renderedPrompt: { prompt: string; prompt_digest: string }
): Promise<LlmIncidentAnalysis> => {
  if (!env.LLM_API_URL) {
    throw {
      httpStatus: 503,
      message: "LLM API URL is not configured",
      retryable: false
    } satisfies AttemptFailure;
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
        model: governance.model,
        task: governance.task,
        prompt_version: governance.prompt_version,
        prompt_digest: renderedPrompt.prompt_digest,
        prompt: renderedPrompt.prompt,
        input
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw {
        httpStatus: response.status,
        message: `LLM API request failed with status ${response.status}`,
        retryable: shouldRetryStatus(response.status)
      } satisfies AttemptFailure;
    }

    const payload: unknown = await response.json();
    return parseLlmPayload(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw {
        httpStatus: 504,
        message: "LLM API request timed out",
        retryable: true
      } satisfies AttemptFailure;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "httpStatus" in error &&
      "message" in error &&
      "retryable" in error
    ) {
      throw error;
    }

    throw {
      httpStatus: 502,
      message: "LLM API request failed unexpectedly",
      retryable: true
    } satisfies AttemptFailure;
  } finally {
    clearTimeout(timeout);
  }
};

const attemptLlmAnalysis = async (
  input: AnalyzeIncidentInput,
  governance: GovernanceMeta,
  renderedPrompt: { prompt: string; prompt_digest: string }
): Promise<{ analysis: LlmIncidentAnalysis; attempts: number }> => {
  const maxAttempts = env.LLM_MAX_RETRIES + 1;
  let attempt = 0;
  let lastFailure: AttemptFailure | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      const analysis = await performLlmRequest(input, governance, renderedPrompt);
      return { analysis, attempts: attempt };
    } catch (error) {
      lastFailure = error as AttemptFailure;

      if (!lastFailure.retryable || attempt >= maxAttempts) {
        break;
      }

      const backoffMs = env.LLM_RETRY_BACKOFF_MS * attempt;
      logger.warn("retrying llm analysis request", {
        attempt,
        backoff_ms: backoffMs,
        reason: lastFailure.message
      });
      await wait(backoffMs);
    }
  }

  throw (
    lastFailure
      ? { ...lastFailure, attempts: attempt }
      : {
          httpStatus: 502,
          message: "LLM API request failed without an error payload",
          retryable: false,
          attempts: attempt
        }
  );
};

const finalizeMeta = (meta: Omit<LlmAnalyzeMeta, "report_model" | "retries">): LlmAnalyzeMeta => {
  return {
    ...meta,
    report_model: buildReportModel(
      {
        task: meta.task,
        prompt_version: meta.prompt_version,
        model: meta.model,
        model_version: meta.model_version
      },
      meta.provider,
      meta.fallback_mode
    ),
    retries: Math.max(0, meta.attempts - 1)
  };
};

export const analyzeIncidentWithLlmApi = async (
  input: AnalyzeIncidentInput
): Promise<LlmAnalyzeResult> => {
  const governance = getGovernanceMeta();
  const renderedPrompt = renderPrompt(governance.task, governance.prompt_version, input);
  const inputDigest = getInputDigest(input, governance, renderedPrompt.prompt_digest);
  const startedAtMs = Date.now();
  const initialCircuitState = getCircuitState(startedAtMs);

  if (initialCircuitState === "open") {
    const failureReason = "LLM circuit breaker is open";

    if (env.LLM_FALLBACK_MODE === "deterministic") {
      logger.warn("using fallback analysis because circuit breaker is open", {
        task: governance.task,
        input_digest: inputDigest
      });
      return {
        analysis: buildFallbackAnalysis(input, failureReason),
        meta: finalizeMeta({
          provider: "fallback",
          fallback_mode: "deterministic",
          degraded: true,
          task: governance.task,
          prompt_version: governance.prompt_version,
          prompt_digest: renderedPrompt.prompt_digest,
          model: governance.model,
          model_version: governance.model_version,
          input_digest: inputDigest,
          attempts: 0,
          latency_ms: Date.now() - startedAtMs,
          circuit_state: initialCircuitState,
          failure_reason: failureReason
        })
      };
    }

    throw new HttpError(503, failureReason);
  }

  try {
    const { analysis, attempts } = await attemptLlmAnalysis(input, governance, renderedPrompt);
    recordCircuitSuccess();

    return {
      analysis,
      meta: finalizeMeta({
        provider: "llm_api",
        fallback_mode: env.LLM_FALLBACK_MODE,
        degraded: false,
        task: governance.task,
        prompt_version: governance.prompt_version,
        prompt_digest: renderedPrompt.prompt_digest,
        model: governance.model,
        model_version: governance.model_version,
        input_digest: inputDigest,
        attempts,
        latency_ms: Date.now() - startedAtMs,
        circuit_state: getCircuitState(Date.now()),
        failure_reason: null
      })
    };
  } catch (error) {
    const failure = error as AttemptFailure;
    const attempts = failure.attempts ?? 1;
    recordCircuitFailure();
    const circuitStateAfterFailure = getCircuitState(Date.now());

    if (env.LLM_FALLBACK_MODE === "deterministic") {
      logger.warn("using fallback analysis after llm request failure", {
        task: governance.task,
        failure_reason: failure.message,
        circuit_state: circuitStateAfterFailure,
        input_digest: inputDigest
      });

      return {
        analysis: buildFallbackAnalysis(input, failure.message),
        meta: finalizeMeta({
          provider: "fallback",
          fallback_mode: "deterministic",
          degraded: true,
          task: governance.task,
          prompt_version: governance.prompt_version,
          prompt_digest: renderedPrompt.prompt_digest,
          model: governance.model,
          model_version: governance.model_version,
          input_digest: inputDigest,
          attempts,
          latency_ms: Date.now() - startedAtMs,
          circuit_state: circuitStateAfterFailure,
          failure_reason: failure.message
        })
      };
    }

    throw new HttpError(failure.httpStatus, failure.message);
  }
};
