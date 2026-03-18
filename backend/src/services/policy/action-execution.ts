import { query } from "../../core/db/pool";
import {
  getActiveActionState,
  ManagedActionScope,
  ManagedActionType
} from "./action-state";

export type ActionExecutionState =
  | "requested"
  | "dispatched"
  | "effective"
  | "expired"
  | "rolled_back"
  | "failed";

interface ActionRow {
  id: string;
  incident_id: string;
  action_type: ManagedActionType | "rollback";
  scope: ManagedActionScope;
  target: string;
  ttl_seconds: number | null;
  result: "pending" | "success" | "fail";
  executed_at: string | Date | null;
}

interface ActionEnforcementLog {
  created_at: string | Date;
  detail: {
    source?: string;
    http_status?: number;
    reason?: string;
    matched_key?: string;
    scope?: string;
    action_type?: string;
    target?: string;
    event_time?: string;
    [key: string]: unknown;
  };
}

export interface ActionExecutionView {
  execution_state: ActionExecutionState;
  dispatch_meta: {
    redis_key: string | null;
    redis_cached: boolean;
    cached_at: string | null;
    dispatched_at: string | null;
  };
  enforcement_meta: {
    effective: boolean;
    effective_at: string | null;
    source: string | null;
    http_status: number | null;
    reason: string | null;
  };
}

const normalizeTimestamp = (value: string | Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
};

const resolveExecutionState = (params: {
  action: ActionRow;
  redisCached: boolean;
  effective: boolean;
}): ActionExecutionState => {
  const { action, redisCached, effective } = params;

  if (action.result === "fail") {
    return "failed";
  }

  if (action.action_type === "rollback") {
    return "rolled_back";
  }

  if (effective) {
    return "effective";
  }

  if (redisCached) {
    return "dispatched";
  }

  if (action.result === "pending") {
    return "requested";
  }

  return "expired";
};

export const getActionExecutionViewByRow = async (action: ActionRow): Promise<ActionExecutionView> => {
  let redisKey: string | null = null;
  let redisCached = false;
  let cachedAt: string | null = null;

  if (action.action_type !== "rollback") {
    const cached = await getActiveActionState({
      scope: action.scope,
      action_type: action.action_type,
      target: action.target
    });

    redisKey = cached.key;
    redisCached = cached.exists;
    cachedAt =
      cached.value && typeof cached.value.cached_at === "string" ? String(cached.value.cached_at) : null;
  }

  const enforcedResult = await query<ActionEnforcementLog>(
    `SELECT created_at, detail
     FROM audit_logs
     WHERE action = 'action_enforced' AND target_type = 'action' AND target_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [action.id]
  );

  const latest = enforcedResult.rows[0] ?? null;
  const effective = latest !== null;

  return {
    execution_state: resolveExecutionState({
      action,
      redisCached,
      effective
    }),
    dispatch_meta: {
      redis_key: redisKey,
      redis_cached: redisCached,
      cached_at: cachedAt,
      dispatched_at: normalizeTimestamp(action.executed_at)
    },
    enforcement_meta: {
      effective,
      effective_at: normalizeTimestamp(latest?.created_at),
      source: latest?.detail?.source ? String(latest.detail.source) : null,
      http_status:
        latest?.detail?.http_status !== undefined && latest?.detail?.http_status !== null
          ? Number(latest.detail.http_status)
          : null,
      reason: latest?.detail?.reason ? String(latest.detail.reason) : null
    }
  };
};

export const getActionExecutionView = async (actionId: string): Promise<ActionExecutionView | null> => {
  const actionResult = await query<ActionRow>(
    `SELECT id, incident_id, action_type, scope, target, ttl_seconds, result, executed_at
     FROM actions
     WHERE id = $1
     LIMIT 1`,
    [actionId]
  );

  if (actionResult.rowCount === 0) {
    return null;
  }

  return getActionExecutionViewByRow(actionResult.rows[0]);
};
