import { env } from "../../core/config/env";
import { query } from "../../core/db/pool";
import { logger } from "../../core/logger";

interface PendingActionRow {
  id: string;
  incident_id: string;
  action_type: "rate_limit" | "block" | "challenge" | "rollback";
  scope: "ip" | "uri" | "global";
  target: string;
  requested_by: string | null;
  executed_by: string | null;
  created_at: string;
}

let watchdogTimer: NodeJS.Timeout | null = null;
let loopRunning = false;

const isTimeout = (createdAtIso: string): boolean => {
  const createdAtMs = new Date(createdAtIso).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  return Date.now() - createdAtMs >= env.ACTION_VERIFY_PENDING_TIMEOUT_MS;
};

const markTimeout = async (action: PendingActionRow): Promise<void> => {
  const updateResult = await query(
    `UPDATE actions
     SET result = 'fail', executed_at = NOW()
     WHERE id = $1 AND result = 'pending'`,
    [action.id]
  );

  if ((updateResult.rowCount ?? 0) === 0) {
    return;
  }

  const reason = `verification timeout after ${env.ACTION_VERIFY_PENDING_TIMEOUT_MS}ms`;
  const actor = action.executed_by ?? action.requested_by ?? "watchdog";

  await query(
    `INSERT INTO action_receipts (action_id, operation, status, observed_status, reason, probe_mode, detail)
     VALUES ($1, $2, 'timeout', NULL, $3, 'watchdog_timeout', $4)`,
    [
      action.id,
      action.action_type === "rollback" ? "rollback" : "apply",
      reason,
      JSON.stringify({
        incident_id: action.incident_id,
        action_type: action.action_type,
        scope: action.scope,
        target: action.target,
        created_at: action.created_at,
        timeout_ms: env.ACTION_VERIFY_PENDING_TIMEOUT_MS
      })
    ]
  );

  await query(
    `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
     VALUES ($1, 'action_verification_timeout', 'action', $2, $3)`,
    [
      actor,
      action.id,
      JSON.stringify({
        incident_id: action.incident_id,
        action_type: action.action_type,
        scope: action.scope,
        target: action.target,
        timeout_ms: env.ACTION_VERIFY_PENDING_TIMEOUT_MS
      })
    ]
  );
};

const tickWatchdog = async (): Promise<void> => {
  if (!env.ACTION_VERIFY_WATCHDOG_ENABLED || loopRunning) {
    return;
  }

  loopRunning = true;

  try {
    const result = await query<PendingActionRow>(
      `SELECT id::text, incident_id::text, action_type, scope, target, requested_by, executed_by, created_at::text
       FROM actions
       WHERE result = 'pending'
       ORDER BY created_at ASC
       LIMIT $1`,
      [env.ACTION_VERIFY_WATCHDOG_BATCH_SIZE]
    );

    const expired = result.rows.filter((row) => isTimeout(row.created_at));

    for (const action of expired) {
      await markTimeout(action);
    }

    if (expired.length > 0) {
      logger.warn("action watchdog marked pending actions as timeout", {
        count: expired.length,
        timeout_ms: env.ACTION_VERIFY_PENDING_TIMEOUT_MS
      });
    }
  } catch (error) {
    logger.error("action watchdog tick failed", error instanceof Error ? error.message : String(error));
  } finally {
    loopRunning = false;
  }
};

export const startActionWatchdog = (): void => {
  if (!env.ACTION_VERIFY_WATCHDOG_ENABLED || watchdogTimer) {
    return;
  }

  watchdogTimer = setInterval(() => {
    void tickWatchdog();
  }, env.ACTION_VERIFY_WATCHDOG_INTERVAL_MS);

  watchdogTimer.unref();
  void tickWatchdog();

  logger.info("action watchdog started", {
    interval_ms: env.ACTION_VERIFY_WATCHDOG_INTERVAL_MS,
    timeout_ms: env.ACTION_VERIFY_PENDING_TIMEOUT_MS
  });
};

export const stopActionWatchdog = (): void => {
  if (!watchdogTimer) {
    return;
  }

  clearInterval(watchdogTimer);
  watchdogTimer = null;
  logger.info("action watchdog stopped");
};
