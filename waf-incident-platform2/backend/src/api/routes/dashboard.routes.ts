import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler";
import { query } from "../../core/db/pool";
import { parseRangeToHours } from "../../core/http/query-utils";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const hours = parseRangeToHours(req.query.range as string | undefined);

    const [summary, topIp, topUri, topRule, actionStats] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS request_count,
           COUNT(*) FILTER (WHERE rule_id IS NOT NULL)::int AS waf_hits,
           COUNT(*) FILTER (WHERE waf_action IN ('block', 'deny'))::int AS blocked_count
         FROM events_raw
         WHERE ts >= NOW() - ($1::int * INTERVAL '1 hour')`,
        [hours]
      ),
      query(
        `SELECT src_ip::text AS src_ip, COUNT(*)::int AS count
         FROM events_raw
         WHERE ts >= NOW() - ($1::int * INTERVAL '1 hour') AND src_ip IS NOT NULL
         GROUP BY src_ip
         ORDER BY count DESC
         LIMIT 10`,
        [hours]
      ),
      query(
        `SELECT uri, COUNT(*)::int AS count
         FROM events_raw
         WHERE ts >= NOW() - ($1::int * INTERVAL '1 hour') AND uri IS NOT NULL
         GROUP BY uri
         ORDER BY count DESC
         LIMIT 10`,
        [hours]
      ),
      query(
        `SELECT rule_id, COUNT(*)::int AS count
         FROM events_raw
         WHERE ts >= NOW() - ($1::int * INTERVAL '1 hour') AND rule_id IS NOT NULL
         GROUP BY rule_id
         ORDER BY count DESC
         LIMIT 10`,
        [hours]
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE result = 'success')::int AS action_success,
           COUNT(*)::int AS action_total
         FROM actions
         WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')`,
        [hours]
      )
    ]);

    res.json({
      range_hours: hours,
      summary: summary.rows[0],
      top_attack_sources: topIp.rows,
      top_target_uris: topUri.rows,
      top_rules: topRule.rows,
      action_stats: actionStats.rows[0]
    });
  })
);

dashboardRouter.get(
  "/timeseries",
  asyncHandler(async (req, res) => {
    const metric = (req.query.metric as string | undefined) ?? "alerts";
    const hours = parseRangeToHours(req.query.range as string | undefined);

    let sql = "";

    if (metric === "requests") {
      sql = `
        SELECT date_trunc('hour', ts) AS bucket, COUNT(*)::int AS value
        FROM events_raw
        WHERE ts >= NOW() - ($1::int * INTERVAL '1 hour')
        GROUP BY bucket
        ORDER BY bucket ASC
      `;
    } else if (metric === "blocks") {
      sql = `
        SELECT date_trunc('hour', created_at) AS bucket, COUNT(*)::int AS value
        FROM actions
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
          AND action_type = 'block'
          AND result = 'success'
        GROUP BY bucket
        ORDER BY bucket ASC
      `;
    } else {
      sql = `
        SELECT date_trunc('hour', created_at) AS bucket, COUNT(*)::int AS value
        FROM alerts
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')
        GROUP BY bucket
        ORDER BY bucket ASC
      `;
    }

    const result = await query(sql, [hours]);
    res.json({ metric, range_hours: hours, series: result.rows });
  })
);
