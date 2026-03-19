import { describe, beforeEach, test, expect, jest } from "@jest/globals";

type MockFetchResponse = {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
};

const loadAnalyzer = () => {
  jest.resetModules();
  return require("../../../backend/src/services/llm/incident-analyzer") as typeof import("../../../backend/src/services/llm/incident-analyzer");
};

const buildInput = () => ({
  requested_by: "tester",
  asset_id: null,
  src_ip: "203.0.113.10",
  events: [
    {
      id: 1,
      ts: "2026-03-04T00:00:00.000Z",
      asset_id: null,
      src_ip: "203.0.113.10",
      method: "GET",
      uri: "/login",
      status: 403,
      rule_id: "942100",
      rule_msg: "SQL Injection Attack Detected",
      rule_score: 8,
      waf_action: "deny"
    }
  ]
});

describe("analyzeIncidentWithLlmApi", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    process.env.LLM_API_URL = "https://llm.example.test/analyze";
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "mock-model";
    process.env.LLM_MODEL_VERSION = "2026-03-04";
    process.env.LLM_TASK_NAME = "waf_incident_analysis_mvp";
    process.env.LLM_PROMPT_VERSION = "v1";
    process.env.LLM_TIMEOUT_MS = "50";
    process.env.LLM_MAX_RETRIES = "1";
    process.env.LLM_RETRY_BACKOFF_MS = "1";
    process.env.LLM_CIRCUIT_BREAKER_THRESHOLD = "2";
    process.env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS = "60000";
    process.env.LLM_FALLBACK_MODE = "deterministic";
  });

  test("retries once and returns llm metadata after a transient 500", async () => {
    const fetchMock = jest
      .fn<(...args: unknown[]) => Promise<MockFetchResponse>>()
      .mockResolvedValueOnce({
        ok: false,
        status: 500
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: "SQLi from 203.0.113.10",
          summary: "validated",
          severity: "high",
          attack_chain: [],
          key_iocs: [],
          risk_assessment: {},
          recommended_actions_low: [],
          recommended_actions_high: ["request approval"],
          confidence: 92
        })
      });

    (global as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const { analyzeIncidentWithLlmApi } = loadAnalyzer();
    const result = await analyzeIncidentWithLlmApi(buildInput());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.meta.provider).toBe("llm_api");
    expect(result.meta.retries).toBe(1);
    expect(result.meta.prompt_version).toBe("v1");
    expect(result.meta.prompt_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.meta.report_model).toBe("mock-model@2026-03-04#v1");
    expect(result.analysis.title).toBe("SQLi from 203.0.113.10");
  });

  test("falls back deterministically after repeated upstream failure", async () => {
    const fetchMock = jest
      .fn<(...args: unknown[]) => Promise<MockFetchResponse>>()
      .mockResolvedValue({
        ok: false,
        status: 503
      });

    (global as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const { analyzeIncidentWithLlmApi } = loadAnalyzer();
    const result = await analyzeIncidentWithLlmApi(buildInput());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.meta.provider).toBe("fallback");
    expect(result.meta.degraded).toBe(true);
    expect(result.meta.failure_reason).toContain("503");
    expect(result.analysis.summary).toContain("Deterministic fallback");
  });
});