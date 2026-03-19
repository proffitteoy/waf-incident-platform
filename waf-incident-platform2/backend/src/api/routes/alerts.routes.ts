import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler";
import { query } from "../../core/db/pool";
import { parseLimit, parseOffset } from "../../core/http/query-utils";

export const alertsRouter = Router();

alertsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit as string | undefined, 50);
    const offset = parseOffset(req.query.offset as string | undefined);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`status = $${params.length}`);
    }
    if (req.query.severity) {
      params.push(req.query.severity);
      conditions.push(`severity = $${params.length}`);
    }
    if (req.query.asset_id) {
      params.push(req.query.asset_id);
      conditions.push(`asset_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT id, asset_id, incident_id, title, severity, status, score, source, first_seen, last_seen, event_count, summary
      FROM alerts
      ${where}
      ORDER BY last_seen DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(sql, params);
    res.json({ items: result.rows, limit, offset });
  })
);
