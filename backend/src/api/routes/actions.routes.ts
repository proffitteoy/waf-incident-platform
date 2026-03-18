import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";
import { env } from "../../core/config/env";
import { logger } from "../../core/logger";
import {
  cacheActiveActionState,
  clearActiveActionState,
  ManagedActionScope,
  ManagedActionType
} from "../../services/policy/action-state";
import { getActionExecutionView, getActionExecutionViewByRow } from "../../services/policy/action-execution";

const executeActionSchema = z.object({
  action_type: z.enum(["rate_limit", "block", "challenge"]),
  scope: z.enum(["ip", "uri", "global"]),
  target: z.string().min(1),
  ttl_seconds: z.number().int().positive().default(1800),
  requested_by: z.string().default("analyst"),
  executed_by: z.string().default("system"),
  reason: z.string().optional()
});

const approvalSchema = z.object({
  action_plan: z.object({
    action_type: z.enum(["rate_limit", "block", "challenge"]),
    scope: z.enum(["ip", "uri", "global"]),
    target: z.string().min(1),
    ttl_seconds: z.number().int().positive().default(1800)
  }),
  risk_level: z.enum(["low", "med", "high"]),
  requested_by: z.string().default("analyst"),
  justification: z.string().optional()
});

const rollbackSchema = z.object({
  actor: z.string().default("analyst"),
  reason: z.string().default("manual rollback")
});

const enforcementConfirmSchema = z.object({
  action_id: z.string().min(1),
  source: z.string().default("gateway-actuator"),
  scope: z.enum(["ip", "uri", "global"]).optional(),
  action_type: z.enum(["rate_limit", "block", "challenge"]).optional(),
  target: z.string().optional(),
  matched_key: z.string().optional(),
  http_status: z.number().int().optional(),
  reason: z.string().optional(),
  event_time: z.string().datetime().optional()
});

export const actionsRouter = Router();

actionsRouter.post(
  "/incidents/:id/actions/execute",
  asyncHandler(async (req, res) => {
    const input = executeActionSchema.parse(req.body);

    const result = await query<{
      id: string;
      incident_id: string;
      action_type: ManagedActionType;
      scope: ManagedActionScope;
      target: string;
      ttl_seconds: number;
      requested_by: string;
      executed_by: string;
      result: "pending" | "success" | "fail";
      detail: string | null;
      rollback_token: string | null;
      created_at: string;
      executed_at: string | null;
    }>(
      `INSERT INTO actions (
         incident_id, action_type, scope, target, ttl_seconds, requested_by,
         executed_by, result, detail, rollback_token, executed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, NOW())
       RETURNING id, incident_id, action_type, scope, target, ttl_seconds, requested_by,
                 executed_by, result, detail, rollback_token, created_at, executed_at`,
      [
        req.params.id,
        input.action_type,
        input.scope,
        input.target,
        input.ttl_seconds,
        input.requested_by,
        input.executed_by,
        input.reason ?? "auto action executed",
        `rbk:${req.params.id}:${Date.now()}`
      ]
    );

    const createdAction = result.rows[0];
    let redisKey: string | null = null;
    let dispatchResult: "success" | "fail" = "success";
    let dispatchDetail = createdAction.detail ?? "auto action executed";

    try {
      redisKey = await cacheActiveActionState({
        action_id: createdAction.id,
        incident_id: req.params.id,
        action_type: input.action_type,
        scope: input.scope,
        target: input.target,
        ttl_seconds: input.ttl_seconds,
        requested_by: input.requested_by,
        executed_by: input.executed_by
      });
    } catch (error) {
      dispatchResult = "fail";
      dispatchDetail = `dispatch failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error("failed to cache active action state", error instanceof Error ? error.message : error);
    }

    const persisted = await query<{
      id: string;
      incident_id: string;
      action_type: ManagedActionType;
      scope: ManagedActionScope;
      target: string;
      ttl_seconds: number;
      requested_by: string;
      executed_by: string;
      result: "pending" | "success" | "fail";
      detail: string | null;
      rollback_token: string | null;
      created_at: string;
      executed_at: string | null;
    }>(
      `UPDATE actions
       SET result = $2, detail = $3
       WHERE id = $1
       RETURNING id, incident_id, action_type, scope, target, ttl_seconds, requested_by,
                 executed_by, result, detail, rollback_token, created_at, executed_at`,
      [createdAction.id, dispatchResult, dispatchDetail]
    );

    const action = persisted.rows[0];

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.executed_by,
        "action_executed",
        "incident",
        req.params.id,
        JSON.stringify({
          action_id: action.id,
          action_type: input.action_type,
          dispatch_result: dispatchResult,
          redis_key: redisKey
        })
      ]
    );

    const executionView = await getActionExecutionViewByRow(action);
    res.status(201).json({ ...action, ...executionView });
  })
);

actionsRouter.post(
  "/incidents/:id/actions/request-approval",
  asyncHandler(async (req, res) => {
    const input = approvalSchema.parse(req.body);

    const result = await query(
      `INSERT INTO approvals (incident_id, action_draft, risk_level, status, requested_by, comment)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING id, incident_id, action_draft, risk_level, status, requested_by, reviewed_by, reviewed_at, comment, created_at`,
      [
        req.params.id,
        JSON.stringify(input.action_plan),
        input.risk_level,
        input.requested_by,
        input.justification ?? null
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

actionsRouter.post(
  "/actions/:id/rollback",
  asyncHandler(async (req, res) => {
    const input = rollbackSchema.parse(req.body);

    const originResult = await query<{
      id: string;
      incident_id: string;
      action_type: ManagedActionType | "rollback";
      scope: ManagedActionScope;
      target: string;
    }>(
      `SELECT id, incident_id, action_type, scope, target FROM actions WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );

    if (originResult.rowCount === 0) {
      throw new HttpError(404, "action not found");
    }

    const origin = originResult.rows[0];

    const rollbackResult = await query<{
      id: string;
      incident_id: string;
      action_type: "rollback";
      scope: ManagedActionScope;
      target: string;
      ttl_seconds: number;
      requested_by: string;
      executed_by: string;
      result: "pending" | "success" | "fail";
      detail: string | null;
      rollback_token: string | null;
      created_at: string;
      executed_at: string | null;
    }>(
      `INSERT INTO actions (
         incident_id, action_type, scope, target, ttl_seconds, requested_by,
         executed_by, result, detail, rollback_token, executed_at
       ) VALUES ($1, 'rollback', $2, $3, 0, $4, $4, 'pending', $5, $6, NOW())
       RETURNING id, incident_id, action_type, scope, target, ttl_seconds, requested_by,
                 executed_by, result, detail, rollback_token, created_at, executed_at`,
      [
        origin.incident_id,
        origin.scope,
        origin.target,
        input.actor,
        `rollback for action ${origin.id}: ${input.reason}`,
        `rbk:${origin.id}:${Date.now()}`
      ]
    );

    let redisCleared = false;
    let redisKey: string | null = null;
    let rollbackResultState: "success" | "fail" = "success";
    let rollbackDetail = rollbackResult.rows[0].detail ?? `rollback for action ${origin.id}: ${input.reason}`;

    if (origin.action_type !== "rollback") {
      try {
        const cleared = await clearActiveActionState({
          scope: origin.scope,
          action_type: origin.action_type,
          target: origin.target
        });
        redisCleared = cleared.deleted > 0;
        redisKey = cleared.key;
      } catch (error) {
        rollbackResultState = "fail";
        rollbackDetail = `rollback dispatch failed: ${error instanceof Error ? error.message : String(error)}`;
        logger.error("failed to clear active action state", error instanceof Error ? error.message : error);
      }
    }

    const persistedRollback = await query<{
      id: string;
      incident_id: string;
      action_type: "rollback";
      scope: ManagedActionScope;
      target: string;
      ttl_seconds: number;
      requested_by: string;
      executed_by: string;
      result: "pending" | "success" | "fail";
      detail: string | null;
      rollback_token: string | null;
      created_at: string;
      executed_at: string | null;
    }>(
      `UPDATE actions
       SET result = $2, detail = $3
       WHERE id = $1
       RETURNING id, incident_id, action_type, scope, target, ttl_seconds, requested_by,
                 executed_by, result, detail, rollback_token, created_at, executed_at`,
      [rollbackResult.rows[0].id, rollbackResultState, rollbackDetail]
    );

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.actor,
        "action_rollback",
        "action",
        req.params.id,
        JSON.stringify({
          rollback_action_id: rollbackResult.rows[0].id,
          reason: input.reason,
          redis_key: redisKey,
          redis_cleared: redisCleared,
          rollback_result: rollbackResultState
        })
      ]
    );

    const executionView = await getActionExecutionViewByRow(persistedRollback.rows[0]);

    res.json({
      ...persistedRollback.rows[0],
      ...executionView,
      redis_key: redisKey,
      redis_cleared: redisCleared
    });
  })
);

actionsRouter.post(
  "/actions/enforcement/confirm",
  asyncHandler(async (req, res) => {
    if (env.ACTUATOR_CONFIRM_TOKEN) {
      const token = req.header("x-actuator-token");

      if (token !== env.ACTUATOR_CONFIRM_TOKEN) {
        throw new HttpError(401, "unauthorized actuator confirmation");
      }
    }

    const input = enforcementConfirmSchema.parse(req.body);

    const actionResult = await query<{ id: string; incident_id: string }>(
      `SELECT id::text, incident_id::text
       FROM actions
       WHERE id = $1
       LIMIT 1`,
      [input.action_id]
    );

    if (actionResult.rowCount === 0) {
      throw new HttpError(404, "action not found");
    }

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.source,
        "action_enforced",
        "action",
        input.action_id,
        JSON.stringify({
          source: input.source,
          scope: input.scope,
          action_type: input.action_type,
          target: input.target,
          matched_key: input.matched_key,
          http_status: input.http_status,
          reason: input.reason,
          event_time: input.event_time ?? new Date().toISOString()
        })
      ]
    );

    const executionView = await getActionExecutionView(input.action_id);
    res.status(202).json({
      action_id: input.action_id,
      incident_id: actionResult.rows[0].incident_id,
      accepted: true,
      ...executionView
    });
  })
);

actionsRouter.get(
  "/actions/:id/status",
  asyncHandler(async (req, res) => {
    const executionView = await getActionExecutionView(req.params.id);

    if (!executionView) {
      throw new HttpError(404, "action not found");
    }

    res.json({ action_id: req.params.id, ...executionView });
  })
);

actionsRouter.get(
  "/incidents/:id/actions/timeline",
  asyncHandler(async (req, res) => {
    const actionsResult = await query<{
      id: string;
      incident_id: string;
      action_type: ManagedActionType | "rollback";
      scope: ManagedActionScope;
      target: string;
      ttl_seconds: number | null;
      requested_by: string | null;
      executed_by: string | null;
      result: "pending" | "success" | "fail";
      detail: string | null;
      rollback_token: string | null;
            created_at: string | Date;
            executed_at: string | Date | null;
    }>(
            `SELECT id, incident_id, action_type, scope, target, ttl_seconds, requested_by,
              executed_by, result, detail, rollback_token, created_at, executed_at
       FROM actions
       WHERE incident_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    const items = await Promise.all(
      actionsResult.rows.map(async (action) => ({
        ...action,
        ...(await getActionExecutionViewByRow(action))
      }))
    );

    res.json({ items });
  })
);
