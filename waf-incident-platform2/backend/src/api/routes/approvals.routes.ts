import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { pool, query } from "../../core/db/pool";
import { logger } from "../../core/logger";
import {
  cacheActiveActionState,
  ManagedActionScope,
  ManagedActionType
} from "../../services/policy/action-state";

const approveSchema = z.object({
  reviewer: z.string().default("approver"),
  comment: z.string().optional()
});

const rejectSchema = z.object({
  reviewer: z.string().default("approver"),
  comment: z.string().min(1)
});

export const approvalsRouter = Router();

approvalsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = (req.query.status as string | undefined) ?? "pending";
    const result = await query(
      `SELECT id, incident_id, action_draft, risk_level, status, requested_by, reviewed_by, reviewed_at, comment, created_at
       FROM approvals
       WHERE status = $1
       ORDER BY created_at DESC`,
      [status]
    );

    res.json({ items: result.rows });
  })
);

approvalsRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const input = approveSchema.parse(req.body);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const approvalResult = await client.query<{
        id: string;
        incident_id: string;
        action_draft: {
          action_type?: string;
          scope?: string;
          target?: string;
          ttl_seconds?: number;
          requested_by?: string;
        };
      }>(
        `UPDATE approvals
         SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), comment = COALESCE($2, comment)
         WHERE id = $3 AND status = 'pending'
         RETURNING id, incident_id, action_draft`,
        [input.reviewer, input.comment ?? null, req.params.id]
      );

      if (approvalResult.rowCount === 0) {
        throw new HttpError(404, "approval not found or already handled");
      }

      const approval = approvalResult.rows[0];
      const draft = approval.action_draft ?? {};

      const actionResult = await client.query(
        `INSERT INTO actions (
           incident_id, approval_id, action_type, scope, target, ttl_seconds,
           requested_by, executed_by, result, detail, rollback_token, executed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'success', $9, $10, NOW())
         RETURNING id, incident_id, action_type, scope, target, ttl_seconds, requested_by, executed_by, result, detail, rollback_token, created_at, executed_at`,
        [
          approval.incident_id,
          approval.id,
          draft.action_type ?? "block",
          draft.scope ?? "ip",
          draft.target ?? "unknown",
          draft.ttl_seconds ?? 1800,
          draft.requested_by ?? "system",
          input.reviewer,
          `executed via approval ${approval.id}`,
          `rbk:${approval.id}:${Date.now()}`
        ]
      );

      await client.query(
        `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.reviewer,
          "approval_approved",
          "approval",
          approval.id,
          JSON.stringify({ action_id: actionResult.rows[0].id })
        ]
      );

      await client.query("COMMIT");
      let redisKey: string | null = null;

      try {
        redisKey = await cacheActiveActionState({
          action_id: actionResult.rows[0].id,
          incident_id: actionResult.rows[0].incident_id,
          action_type: actionResult.rows[0].action_type as ManagedActionType,
          scope: actionResult.rows[0].scope as ManagedActionScope,
          target: actionResult.rows[0].target,
          ttl_seconds: actionResult.rows[0].ttl_seconds ?? 1800,
          requested_by: actionResult.rows[0].requested_by,
          executed_by: actionResult.rows[0].executed_by
        });
      } catch (error) {
        logger.error("failed to cache approved action state", error instanceof Error ? error.message : error);
      }

      res.json({ approval_id: approval.id, action: { ...actionResult.rows[0], redis_key: redisKey } });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

approvalsRouter.post(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    const input = rejectSchema.parse(req.body);
    const result = await query(
      `UPDATE approvals
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), comment = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING id, incident_id, status, reviewed_by, reviewed_at, comment`,
      [input.reviewer, input.comment, req.params.id]
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "approval not found or already handled");
    }

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.reviewer, "approval_rejected", "approval", req.params.id, JSON.stringify({ comment: input.comment })]
    );

    res.json(result.rows[0]);
  })
);
