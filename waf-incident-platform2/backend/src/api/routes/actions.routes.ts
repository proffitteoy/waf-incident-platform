import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";
import { logger } from "../../core/logger";
import {
  cacheActiveActionState,
  clearActiveActionState,
  ManagedActionScope,
  ManagedActionType
} from "../../services/policy/action-state";

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

export const actionsRouter = Router();

actionsRouter.post(
  "/incidents/:id/actions/execute",
  asyncHandler(async (req, res) => {
    const input = executeActionSchema.parse(req.body);

    const result = await query(
      `INSERT INTO actions (
         incident_id, action_type, scope, target, ttl_seconds, requested_by,
         executed_by, result, detail, rollback_token, executed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', $8, $9, NOW())
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

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.executed_by,
        "action_executed",
        "incident",
        req.params.id,
        JSON.stringify({ action_id: result.rows[0].id, action_type: input.action_type })
      ]
    );

    let redisKey: string | null = null;

    try {
      redisKey = await cacheActiveActionState({
        action_id: result.rows[0].id,
        incident_id: req.params.id,
        action_type: input.action_type,
        scope: input.scope,
        target: input.target,
        ttl_seconds: input.ttl_seconds,
        requested_by: input.requested_by,
        executed_by: input.executed_by
      });
    } catch (error) {
      logger.error("failed to cache active action state", error instanceof Error ? error.message : error);
    }

    res.status(201).json({ ...result.rows[0], redis_key: redisKey });
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

    const rollbackResult = await query(
      `INSERT INTO actions (
         incident_id, action_type, scope, target, ttl_seconds, requested_by,
         executed_by, result, detail, rollback_token, executed_at
       ) VALUES ($1, 'rollback', $2, $3, 0, $4, $4, 'success', $5, $6, NOW())
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

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.actor,
        "action_rollback",
        "action",
        req.params.id,
        JSON.stringify({ rollback_action_id: rollbackResult.rows[0].id, reason: input.reason })
      ]
    );

    let redisCleared = false;
    let redisKey: string | null = null;

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
        logger.error("failed to clear active action state", error instanceof Error ? error.message : error);
      }
    }

    res.json({ ...rollbackResult.rows[0], redis_key: redisKey, redis_cleared: redisCleared });
  })
);
