import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler";
import { query } from "../../core/db/pool";
import { parseLimit, parseOffset } from "../../core/http/query-utils";

export const eventsRouter = Router();

eventsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit as string | undefined, 100);
    const offset = parseOffset(req.query.offset as string | undefined);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.asset_id) {
      params.push(req.query.asset_id);
      conditions.push(`asset_id = $${params.length}`);
    }
    if (req.query.src_ip) {
      params.push(req.query.src_ip);
      conditions.push(`src_ip = $${params.length}`);
    }
    if (req.query.rule_id) {
      params.push(req.query.rule_id);
      conditions.push(`rule_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT id, ts, asset_id, src_ip, method, uri, status, waf_engine, rule_id, rule_msg, rule_score, waf_action, tags
      FROM events_raw
      ${where}
      ORDER BY ts DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(sql, params);
    res.json({ items: result.rows, limit, offset });
  })
);
