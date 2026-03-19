declare const process: {
  env: Record<string, string | undefined>;
};
declare const describe: ((name: string, fn: () => void) => void) & {
  skip: (name: string, fn: () => void) => void;
};
declare const beforeAll: (fn: () => Promise<void> | void) => void;
declare const test: (name: string, fn: () => Promise<void> | void, timeout?: number) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toBeTruthy: () => void;
  toContain: (expected: unknown) => void;
};

const runE2E = process.env.RUN_GATEWAY_E2E === "true";
const describeE2E = runE2E ? describe : describe.skip;

const BACKEND_BASE_URL = (process.env.E2E_BACKEND_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WAF_BASE_URL = (process.env.E2E_WAF_BASE_URL ?? "http://localhost").replace(/\/$/, "");
const E2E_ACTOR = process.env.E2E_ACTOR ?? "gateway-e2e";

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const requestJson = async (
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<{ status: number; headers: Headers; body: unknown }> => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  return {
    status: response.status,
    headers: response.headers,
    body
  };
};

const createIncident = async (label: string): Promise<string> => {
  const srcIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const line = JSON.stringify({
    transaction: {
      time_stamp: new Date().toISOString(),
      client_ip: srcIp,
      request: { method: "GET", uri: `/e2e/${label}` },
      response: { http_code: 403 },
      producer: { engine: "coraza" },
      messages: [
        {
          message: "E2E rule hit",
          details: {
            ruleId: "942100",
            message: "E2E SQLi hit",
            data: "anomaly score 8",
            tags: ["attack-sqli", "e2e"]
          }
        }
      ],
      interruption: { action: "deny" }
    }
  });

  const ingest = await requestJson(BACKEND_BASE_URL, "/api/ingestion/coraza/audit-lines", {
    method: "POST",
    body: JSON.stringify({ lines: [line] })
  });
  expect(ingest.status).toBe(201);

  const analyze = await requestJson(BACKEND_BASE_URL, "/api/incidents/analyze-events", {
    method: "POST",
    body: JSON.stringify({ src_ip: srcIp, limit: 20, requested_by: E2E_ACTOR })
  });

  expect(analyze.status).toBe(201);
  const incidentId = (analyze.body as { incident?: { id?: string } }).incident?.id;
  expect(incidentId).toBeTruthy();
  return String(incidentId);
};

const executeAction = async (incidentId: string, payload: Record<string, unknown>) => {
  const response = await requestJson(BACKEND_BASE_URL, `/api/incidents/${incidentId}/actions/execute`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  expect(response.status).toBe(201);
  expect((response.body as { result?: string }).result).toBe("pending");
  return response.body as { id: string };
};

const rollbackAction = async (actionId: string) => {
  const response = await requestJson(BACKEND_BASE_URL, `/api/actions/${actionId}/rollback`, {
    method: "POST",
    body: JSON.stringify({ actor: E2E_ACTOR, reason: "e2e rollback" })
  });

  expect(response.status).toBe(200);
  expect((response.body as { result?: string }).result).toBe("pending");
  return response.body as { id: string };
};

const waitForStatus = async (
  path: string,
  expectedStatus: number,
  timeoutMs = 30000
): Promise<{ status: number; headers: Headers; body: unknown }> => {
  const startedAt = Date.now();
  let last = await requestJson(WAF_BASE_URL, path);

  while (Date.now() - startedAt < timeoutMs) {
    if (last.status === expectedStatus) {
      return last;
    }

    await wait(500);
    last = await requestJson(WAF_BASE_URL, path);
  }

  throw new Error(`expected status ${expectedStatus}, got ${last.status}`);
};

const waitUntilNotStatus = async (path: string, status: number, timeoutMs = 30000): Promise<number> => {
  const startedAt = Date.now();
  let last = await requestJson(WAF_BASE_URL, path);

  while (Date.now() - startedAt < timeoutMs) {
    if (last.status !== status) {
      return last.status;
    }

    await wait(500);
    last = await requestJson(WAF_BASE_URL, path);
  }

  throw new Error(`status ${status} did not clear in ${timeoutMs}ms`);
};

describeE2E("gateway policy e2e", () => {
  beforeAll(async () => {
    const backendHealth = await requestJson(BACKEND_BASE_URL, "/health");
    expect(backendHealth.status).toBe(200);

    const wafHealth = await requestJson(WAF_BASE_URL, "/health");
    expect(wafHealth.status).toBe(200);
  });

  test(
    "block uri + rollback should enforce 403 then recover",
    async () => {
      const incidentId = await createIncident("block");

      const baseline = await requestJson(WAF_BASE_URL, "/api/attack-scenarios");
      expect(baseline.status).toBe(200);

      const action = await executeAction(incidentId, {
        action_type: "block",
        scope: "uri",
        target: "/api/attack-scenarios",
        ttl_seconds: 120,
        requested_by: E2E_ACTOR,
        executed_by: E2E_ACTOR,
        reason: "e2e block"
      });

      await waitForStatus("/api/attack-scenarios", 403);

      const rollback = await rollbackAction(action.id);
      const recoveredStatus = await waitUntilNotStatus("/api/attack-scenarios", 403);
      expect(recoveredStatus).toBe(200);
    },
    120000
  );

  test(
    "challenge uri should return 401",
    async () => {
      const incidentId = await createIncident("challenge");

      const action = await executeAction(incidentId, {
        action_type: "challenge",
        scope: "uri",
        target: "/api/search",
        ttl_seconds: 120,
        requested_by: E2E_ACTOR,
        executed_by: E2E_ACTOR,
        reason: "e2e challenge"
      });

      const challenged = await waitForStatus("/api/search", 401);
      expect(challenged.headers.get("www-authenticate")).toContain("Basic realm");

      const rollback = await rollbackAction(action.id);
      const recoveredStatus = await waitUntilNotStatus("/api/search", 401);
      expect(recoveredStatus).toBe(200);
    },
    120000
  );

  test(
    "rate_limit uri should return 429 under burst and recover after rollback",
    async () => {
      const incidentId = await createIncident("rate-limit");

      const action = await executeAction(incidentId, {
        action_type: "rate_limit",
        scope: "uri",
        target: "/api/attack-scenarios",
        ttl_seconds: 120,
        requested_by: E2E_ACTOR,
        executed_by: E2E_ACTOR,
        reason: "e2e rate limit"
      });

      let hit429 = false;
      for (let index = 0; index < 50; index += 1) {
        const response = await requestJson(WAF_BASE_URL, "/api/attack-scenarios");
        if (response.status === 429) {
          hit429 = true;
          break;
        }
      }

      expect(hit429).toBe(true);

      const rollback = await rollbackAction(action.id);
      await waitUntilNotStatus("/api/attack-scenarios", 429);
      let still429 = false;
      for (let index = 0; index < 10; index += 1) {
        const response = await requestJson(WAF_BASE_URL, "/api/attack-scenarios");
        if (response.status === 429) {
          still429 = true;
          break;
        }
      }

      expect(still429).toBe(false);
    },
    120000
  );
});
