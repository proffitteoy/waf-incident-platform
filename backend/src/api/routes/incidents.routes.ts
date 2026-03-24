import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";
import { parseLimit, parseOffset } from "../../core/http/query-utils";

const commentSchema = z.object({
  comment: z.string().min(1),
  actor: z.string().default("analyst")
});

export const incidentsRouter = Router();

incidentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit as string | undefined, 50);
    const offset = parseOffset(req.query.offset as string | undefined);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`i.status = $${params.length}`);
    }
    if (req.query.severity) {
      params.push(req.query.severity);
      conditions.push(`i.severity = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT i.id, i.asset_id, i.title, i.severity, i.status, i.first_seen, i.last_seen, i.src_ip, i.summary, i.created_at, i.updated_at,
             EXISTS(SELECT 1 FROM llm_reports lr WHERE lr.incident_id = i.id) AS has_llm_report
      FROM incidents i
      ${where}
      ORDER BY i.last_seen DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(sql, params);
    res.json({ items: result.rows, limit, offset });
  })
);

incidentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const incidentId = req.params.id;

    const incidentResult = await query(
      `SELECT id, asset_id, title, severity, status, first_seen, last_seen, src_ip, summary, created_at, updated_at
       FROM incidents WHERE id = $1 LIMIT 1`,
      [incidentId]
    );

    if (incidentResult.rowCount === 0) {
      throw new HttpError(404, "incident not found");
    }

    const [alerts, actions, approvals, forensics, llmReports] = await Promise.all([
      query(
        `SELECT id, title, severity, status, score, source, first_seen, last_seen, event_count, summary
         FROM alerts WHERE incident_id = $1 ORDER BY last_seen DESC`,
        [incidentId]
      ),
      query(
        `SELECT id, action_type, scope, target, ttl_seconds, requested_by, executed_by, result, detail, rollback_token, created_at, executed_at
         FROM actions WHERE incident_id = $1 ORDER BY created_at DESC`,
        [incidentId]
      ),
      query(
        `SELECT id, action_draft, risk_level, status, requested_by, reviewed_by, reviewed_at, comment, created_at
         FROM approvals WHERE incident_id = $1 ORDER BY created_at DESC`,
        [incidentId]
      ),
      query(
        `SELECT id, ts_start, ts_end, filter, pcap_uri, sha256, size_bytes, status, error_message, created_at, completed_at
         FROM forensics WHERE incident_id = $1 ORDER BY created_at DESC`,
        [incidentId]
      ),
      query(
        `SELECT id, model, task, prompt_version, prompt_digest, input_digest, attack_chain, key_iocs,
                risk_assessment, recommended_actions_low, recommended_actions_high, confidence, created_at
         FROM llm_reports WHERE incident_id = $1 ORDER BY created_at DESC`,
        [incidentId]
      )
    ]);

    res.json({
      incident: incidentResult.rows[0],
      alerts: alerts.rows,
      actions: actions.rows,
      approvals: approvals.rows,
      forensics: forensics.rows,
      llm_reports: llmReports.rows
    });
  })
);

incidentsRouter.post(
  "/:id/comment",
  asyncHandler(async (req, res) => {
    const incidentId = req.params.id;
    const input = commentSchema.parse(req.body);

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.actor, "incident_comment", "incident", incidentId, JSON.stringify({ comment: input.comment })]
    );

    res.status(201).json({ ok: true });
  })
);
