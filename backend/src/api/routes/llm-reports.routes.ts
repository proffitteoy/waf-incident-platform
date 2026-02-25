import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { pool, query } from "../../core/db/pool";
import { analyzeIncidentWithLlmApi } from "../../services/llm/incident-analyzer";

const reportSchema = z.object({
  model: z.string().default("manual"),
  attack_chain: z.array(z.any()).default([]),
  key_iocs: z.array(z.any()).default([]),
  risk_assessment: z.record(z.any()).default({}),
  recommended_actions_low: z.array(z.any()).default([]),
  recommended_actions_high: z.array(z.any()).default([]),
  confidence: z.number().min(0).max(100).optional()
});

const analyzeEventsSchema = z.object({
  asset_id: z.string().uuid().optional(),
  src_ip: z.string().optional(),
  limit: z.number().int().positive().max(500).default(100),
  requested_by: z.string().default("analyst")
});

export const llmReportsRouter = Router();

llmReportsRouter.post(
  "/analyze-events",
  asyncHandler(async (req, res) => {
    const input = analyzeEventsSchema.parse(req.body);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (input.asset_id) {
      params.push(input.asset_id);
      conditions.push(`asset_id = $${params.length}`);
    }

    if (input.src_ip) {
      params.push(input.src_ip);
      conditions.push(`src_ip::text = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(input.limit);

    const eventsResult = await query<{
      id: number;
      ts: string;
      asset_id: string | null;
      src_ip: string | null;
      method: string | null;
      uri: string | null;
      status: number | null;
      rule_id: string | null;
      rule_msg: string | null;
      rule_score: number | null;
      waf_action: string | null;
    }>(
      `SELECT id, ts::text, asset_id::text, src_ip::text, method, uri, status, rule_id, rule_msg, rule_score, waf_action
       FROM events_raw
       ${where}
       ORDER BY ts DESC
       LIMIT $${params.length}`,
      params
    );

    if (eventsResult.rowCount === 0) {
      throw new HttpError(404, "未找到可分析的事件");
    }

    const events = eventsResult.rows;
    const ascendingByTs = [...events].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const firstSeen = ascendingByTs[0].ts;
    const lastSeen = ascendingByTs[ascendingByTs.length - 1].ts;

    const uniqueAssetIds = [...new Set(events.map((event) => event.asset_id).filter(Boolean))];
    const uniqueSrcIps = [...new Set(events.map((event) => event.src_ip).filter(Boolean))];

    const incidentAssetId = input.asset_id ?? (uniqueAssetIds.length === 1 ? uniqueAssetIds[0] : null);
    const incidentSrcIp = uniqueSrcIps.length > 0 ? uniqueSrcIps[0] : null;
    const maxRuleScore = Math.max(0, ...events.map((event) => event.rule_score ?? 0));

    const analysis = await analyzeIncidentWithLlmApi({
      requested_by: input.requested_by,
      asset_id: incidentAssetId,
      src_ip: incidentSrcIp,
      events
    });

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const incidentResult = await client.query<{
        id: string;
        asset_id: string | null;
        title: string;
        severity: "low" | "med" | "high";
        status: "open" | "mitigating" | "resolved";
        first_seen: string;
        last_seen: string;
        src_ip: string | null;
        summary: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `INSERT INTO incidents (asset_id, title, severity, status, first_seen, last_seen, src_ip, summary)
         VALUES ($1, $2, $3, 'open', $4, $5, $6, $7)
         RETURNING id, asset_id::text, title, severity, status, first_seen::text, last_seen::text, src_ip::text, summary, created_at::text, updated_at::text`,
        [incidentAssetId, analysis.title, analysis.severity, firstSeen, lastSeen, incidentSrcIp, analysis.summary]
      );

      const incident = incidentResult.rows[0];

      const alertResult = await client.query(
        `INSERT INTO alerts (
           asset_id, incident_id, title, severity, status, score, source, first_seen, last_seen, event_count, summary
         ) VALUES ($1, $2, $3, $4, 'open', $5, 'llm_direct_analysis', $6, $7, $8, $9)
         RETURNING id, asset_id::text, incident_id::text, title, severity, status, score, source,
                   first_seen::text, last_seen::text, event_count, summary, created_at::text, updated_at::text`,
        [
          incidentAssetId,
          incident.id,
          analysis.title,
          analysis.severity,
          maxRuleScore,
          firstSeen,
          lastSeen,
          events.length,
          analysis.summary
        ]
      );

      const reportResult = await client.query(
        `INSERT INTO llm_reports (
           incident_id, model, attack_chain, key_iocs, risk_assessment,
           recommended_actions_low, recommended_actions_high, confidence
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, incident_id::text, model, attack_chain, key_iocs, risk_assessment,
                   recommended_actions_low, recommended_actions_high, confidence, created_at::text`,
        [
          incident.id,
          "llm_api",
          JSON.stringify(analysis.attack_chain),
          JSON.stringify(analysis.key_iocs),
          JSON.stringify(analysis.risk_assessment),
          JSON.stringify(analysis.recommended_actions_low),
          JSON.stringify(analysis.recommended_actions_high),
          analysis.confidence ?? null
        ]
      );

      await client.query(
        `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.requested_by,
          "llm_incident_generated",
          "incident",
          incident.id,
          JSON.stringify({
            source_events: events.length,
            generated_alert_id: alertResult.rows[0].id,
            generated_report_id: reportResult.rows[0].id
          })
        ]
      );

      await client.query("COMMIT");

      res.status(201).json({
        incident,
        alert: alertResult.rows[0],
        llm_report: reportResult.rows[0],
        source_events: events.length
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

llmReportsRouter.get(
  "/:id/llm-reports",
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, incident_id, model, attack_chain, key_iocs, risk_assessment,
              recommended_actions_low, recommended_actions_high, confidence, created_at
       FROM llm_reports
       WHERE incident_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({ items: result.rows });
  })
);

llmReportsRouter.post(
  "/:id/llm-reports",
  asyncHandler(async (req, res) => {
    const input = reportSchema.parse(req.body);

    const result = await query(
      `INSERT INTO llm_reports (
         incident_id, model, attack_chain, key_iocs, risk_assessment,
         recommended_actions_low, recommended_actions_high, confidence
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, incident_id, model, attack_chain, key_iocs, risk_assessment,
                 recommended_actions_low, recommended_actions_high, confidence, created_at`,
      [
        req.params.id,
        input.model,
        JSON.stringify(input.attack_chain),
        JSON.stringify(input.key_iocs),
        JSON.stringify(input.risk_assessment),
        JSON.stringify(input.recommended_actions_low),
        JSON.stringify(input.recommended_actions_high),
        input.confidence ?? null
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);
