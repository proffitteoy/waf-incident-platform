import { env } from "../../core/config/env";
import { query } from "../../core/db/pool";
import { logger } from "../../core/logger";
import { ManagedActionScope, ManagedActionType } from "./action-state";

type VerificationOperation = "apply" | "rollback";

interface ScheduleVerificationInput {
  action_id: string;
  incident_id: string;
  action_type: ManagedActionType;
  scope: ManagedActionScope;
  target: string;
  actor: string;
  operation: VerificationOperation;
}

interface ProbeResult {
  ok: boolean;
  reason: string;
  observed_status: number | null;
  skipped: boolean;
}

type ReceiptStatus = "success" | "fail" | "skipped";

const trimSlash = (value: string) => value.replace(/\/$/, "");

const normalizePath = (value: string): string => {
  if (!value || value.trim().length === 0) {
    return env.WAF_PROBE_DEFAULT_PATH;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const parsed = new URL(value);
      return `${parsed.pathname}${parsed.search}` || env.WAF_PROBE_DEFAULT_PATH;
    } catch {
      return env.WAF_PROBE_DEFAULT_PATH;
    }
  }

  return value.startsWith("/") ? value : `/${value}`;
};

const requestWithTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ACTION_VERIFY_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        "x-action-verifier": "1"
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

const probeByStatus = async (
  url: string,
  expectedStatus: number,
  operation: VerificationOperation
): Promise<ProbeResult> => {
  const response = await requestWithTimeout(url);
  const status = response.status;
  const ok = operation === "apply" ? status === expectedStatus : status !== expectedStatus;

  return {
    ok,
    reason: ok
      ? `observed status ${status}`
      : `expected ${operation === "apply" ? "" : "not "}${expectedStatus}, got ${status}`,
    observed_status: status,
    skipped: false
  };
};

const probeRateLimit = async (url: string, operation: VerificationOperation): Promise<ProbeResult> => {
  let observed429 = false;
  let lastStatus: number | null = null;

  for (let index = 0; index < env.ACTION_VERIFY_RATE_LIMIT_BURST; index += 1) {
    const response = await requestWithTimeout(url);
    lastStatus = response.status;
    if (response.status === 429) {
      observed429 = true;
      break;
    }
  }

  const ok = operation === "apply" ? observed429 : !observed429;
  return {
    ok,
    reason: ok
      ? `observed429=${observed429}`
      : operation === "apply"
        ? "no 429 observed within probe burst"
        : "429 still observed after rollback",
    observed_status: lastStatus,
    skipped: false
  };
};

const runGatewayProbe = async (input: ScheduleVerificationInput): Promise<ProbeResult> => {
  if (!env.ACTION_VERIFY_ENABLED) {
    return {
      ok: true,
      reason: "verification disabled by ACTION_VERIFY_ENABLED=false",
      observed_status: null,
      skipped: true
    };
  }

  if (input.scope === "ip") {
    return {
      ok: true,
      reason: "ip scope probe skipped: backend-side request cannot deterministically emulate client source ip",
      observed_status: null,
      skipped: true
    };
  }

  const path = input.scope === "uri" ? normalizePath(input.target) : env.WAF_PROBE_DEFAULT_PATH;
  const url = `${trimSlash(env.WAF_PROBE_BASE_URL)}${path}`;

  if (input.action_type === "block") {
    return probeByStatus(url, 403, input.operation);
  }

  if (input.action_type === "challenge") {
    return probeByStatus(url, 401, input.operation);
  }

  return probeRateLimit(url, input.operation);
};

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const runGatewayProbeWithRetry = async (input: ScheduleVerificationInput): Promise<ProbeResult> => {
  let lastResult: ProbeResult | null = null;

  for (let attempt = 1; attempt <= env.ACTION_VERIFY_MAX_ATTEMPTS; attempt += 1) {
    const result = await runGatewayProbe(input);
    lastResult = result;

    if (result.ok || result.skipped || attempt >= env.ACTION_VERIFY_MAX_ATTEMPTS) {
      return {
        ...result,
        reason: `attempt ${attempt}/${env.ACTION_VERIFY_MAX_ATTEMPTS}: ${result.reason}`
      };
    }

    await wait(env.ACTION_VERIFY_RETRY_INTERVAL_MS);
  }

  return (
    lastResult ?? {
      ok: false,
      reason: "probe returned no result",
      observed_status: null,
      skipped: false
    }
  );
};

const insertReceipt = async (
  input: ScheduleVerificationInput,
  status: ReceiptStatus,
  result: ProbeResult
): Promise<void> => {
  await query(
    `INSERT INTO action_receipts (action_id, operation, status, observed_status, reason, probe_mode, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.action_id,
      input.operation,
      status,
      result.observed_status,
      result.reason,
      "gateway_probe",
      JSON.stringify({
        incident_id: input.incident_id,
        action_type: input.action_type,
        scope: input.scope,
        target: input.target,
        skipped: result.skipped,
        verified: result.ok,
        probe_base_url: env.WAF_PROBE_BASE_URL
      })
    ]
  );
};

const updateActionVerificationResult = async (
  input: ScheduleVerificationInput,
  result: ProbeResult
): Promise<void> => {
  const finalResult = result.ok ? "success" : "fail";

  const updateResult = await query(
    `UPDATE actions
     SET result = $1,
         executed_at = NOW()
     WHERE id = $2
       AND result = 'pending'`,
    [finalResult, input.action_id]
  );

  if ((updateResult.rowCount ?? 0) === 0) {
    return;
  }

  const receiptStatus: ReceiptStatus = result.skipped ? "skipped" : result.ok ? "success" : "fail";
  await insertReceipt(input, receiptStatus, result);

  await query(
    `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.actor,
      result.ok ? "action_verification_passed" : "action_verification_failed",
      "action",
      input.action_id,
      JSON.stringify({
        incident_id: input.incident_id,
        operation: input.operation,
        action_type: input.action_type,
        scope: input.scope,
        target: input.target,
        observed_status: result.observed_status,
        reason: result.reason,
        skipped: result.skipped
      })
    ]
  );
};

const verifyAction = async (input: ScheduleVerificationInput): Promise<void> => {
  try {
    const probeResult = await runGatewayProbeWithRetry(input);
    await updateActionVerificationResult(input, probeResult);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error("action verification failed", {
      action_id: input.action_id,
      operation: input.operation,
      reason
    });

    await updateActionVerificationResult(input, {
      ok: false,
      reason,
      observed_status: null,
      skipped: false
    });
  }
};

export const scheduleActionVerification = (input: ScheduleVerificationInput): void => {
  setImmediate(() => {
    void verifyAction(input);
  });
};
