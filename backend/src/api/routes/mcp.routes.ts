import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";
import { parseRangeToHours } from "../../core/http/query-utils";
import { logger } from "../../core/logger";
import { analyzeIncidentWithLlmApi } from "../../services/llm/incident-analyzer";
import {
  cacheActiveActionState,
  clearActiveActionState,
  ManagedActionScope,
  ManagedActionType
} from "../../services/policy/action-state";
import { getActionExecutionView } from "../../services/policy/action-execution";

const invokeSchema = z.object({
  tool: z.string(),
  args: z.record(z.any()).default({})
});

const TOOLS = [
  "query_incidents",
  "get_incident",
  "query_events",
  "get_policies",
  "get_recent_stats",
  "analyze_incident",
  "apply_rate_limit",
  "block_ip_temp",
  "challenge_ip",
  "rollback_action",
  "create_approval_request",
  "capture_pcap",
  "get_forensics",
  "get_pcap_meta"
];

export const mcpRouter = Router();

mcpRouter.get("/tools", (_req, res) => {
  res.json({ tools: TOOLS });
});

mcpRouter.post(
  "/invoke",
  asyncHandler(async (req, res) => {
    const input = invokeSchema.parse(req.body);
    const args = input.args;

    switch (input.tool) {
      case "query_incidents": {
        const status = args.status ?? "open";
        const result = await query(
          `SELECT id, title, severity, status, first_seen, last_seen, src_ip, summary
           FROM incidents
           WHERE status = $1
           ORDER BY last_seen DESC
           LIMIT 100`,
          [status]
        );
        res.json({ data: result.rows });
        return;
      }

      case "get_incident": {
        const result = await query(
          `SELECT id, title, severity, status, first_seen, last_seen, src_ip, summary
           FROM incidents WHERE id = $1 LIMIT 1`,
          [args.incident_id]
        );
        res.json({ data: result.rows[0] ?? null });
        return;
      }

      case "query_events": {
        const limit = Number(args.limit ?? 50);
        const result = await query(
          `SELECT id, ts, src_ip::text, method, uri, status, rule_id, rule_msg, rule_score, waf_action
           FROM events_raw
           WHERE src_ip::text = COALESCE($1, src_ip::text)
           ORDER BY ts DESC
           LIMIT $2`,
          [args.src_ip ?? null, limit]
        );
        res.json({ data: result.rows });
        return;
      }

      case "get_policies": {
        const result = await query(
          `SELECT id, name, risk_threshold_low, risk_threshold_high, low_risk_actions, high_risk_actions,
                  default_ttl_seconds, is_active, version
           FROM policies
           ORDER BY is_active DESC, updated_at DESC`
        );
        res.json({ data: result.rows });
        return;
      }

      case "get_recent_stats": {
        const hours = parseRangeToHours(args.range);
        const result = await query(
          `SELECT
             COUNT(*)::int AS request_count,
             COUNT(*) FILTER (WHERE rule_id IS NOT NULL)::int AS waf_hits,
             COUNT(*) FILTER (WHERE waf_action IN ('block', 'deny'))::int AS blocked_count
           FROM events_raw
           WHERE ts >= NOW() - ($1::int * INTERVAL '1 hour')`,
          [hours]
        );
        res.json({ data: result.rows[0], range_hours: hours });
        return;
      }

      case "analyze_incident": {
        const incidentResult = await query(
          `SELECT id, severity, status, src_ip::text, summary FROM incidents WHERE id = $1 LIMIT 1`,
          [args.incident_id]
        );
        if (incidentResult.rowCount === 0) {
          throw new HttpError(404, "incident not found");
        }

        const eventResult = await query(
          `SELECT rule_id, rule_msg, uri, status, ts
           FROM events_raw
           WHERE src_ip::text = COALESCE($1, src_ip::text)
           ORDER BY ts DESC
           LIMIT 20`,
          [incidentResult.rows[0].src_ip]
        );

        if (eventResult.rowCount === 0) {
          throw new HttpError(404, "incident has no events for llm analysis");
        }

        const llmResult = await analyzeIncidentWithLlmApi({
          requested_by: args.actor ?? "mcp",
          asset_id: null,
          src_ip: incidentResult.rows[0].src_ip ?? null,
          events: eventResult.rows.map((row, index) => ({
            id: index + 1,
            ts: row.ts,
            asset_id: null,
            src_ip: incidentResult.rows[0].src_ip ?? null,
            method: null,
            uri: row.uri,
            status: row.status,
            rule_id: row.rule_id,
            rule_msg: row.rule_msg,
            rule_score: null,
            waf_action: null
          }))
        });

        await query(
          `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            args.actor ?? "mcp",
            "mcp_llm_analysis_completed",
            "incident",
            args.incident_id,
            JSON.stringify({
              provider: llmResult.meta.provider,
              degraded: llmResult.meta.degraded,
              attempts: llmResult.meta.attempts,
              retries: llmResult.meta.retries,
              latency_ms: llmResult.meta.latency_ms,
              circuit_state: llmResult.meta.circuit_state,
              task: llmResult.meta.task,
              prompt_version: llmResult.meta.prompt_version,
              prompt_digest: llmResult.meta.prompt_digest,
              model: llmResult.meta.model,
              model_version: llmResult.meta.model_version,
              report_model: llmResult.meta.report_model,
              input_digest: llmResult.meta.input_digest,
              failure_reason: llmResult.meta.failure_reason
            })
          ]
        );

        res.json({ data: llmResult.analysis, llm_meta: llmResult.meta });
        return;
      }

      case "apply_rate_limit":
      case "block_ip_temp":
      case "challenge_ip": {
        const actionType =
          input.tool === "apply_rate_limit" ? "rate_limit" : input.tool === "block_ip_temp" ? "block" : "challenge";

        const result = await query(
          `INSERT INTO actions (
             incident_id, action_type, scope, target, ttl_seconds, requested_by,
             executed_by, result, detail, rollback_token, executed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $6, 'pending', $7, $8, NOW())
           RETURNING id, incident_id, action_type, scope, target, ttl_seconds, result, created_at, executed_at`,
          [
            args.incident_id,
            actionType,
            args.scope ?? "ip",
            args.target ?? args.ip,
            Number(args.ttl ?? 1800),
            args.actor ?? "mcp",
            args.reason ?? `mcp ${actionType}`,
            `rbk:${Date.now()}`
          ]
        );
        let redisKey: string | null = null;
        let dispatchResult: "success" | "fail" = "success";
        let dispatchDetail = args.reason ?? `mcp ${actionType}`;

        try {
          redisKey = await cacheActiveActionState({
            action_id: result.rows[0].id,
            incident_id: result.rows[0].incident_id,
            action_type: result.rows[0].action_type as ManagedActionType,
            scope: result.rows[0].scope as ManagedActionScope,
            target: result.rows[0].target,
            ttl_seconds: result.rows[0].ttl_seconds ?? 1800,
            requested_by: args.actor ?? "mcp",
            executed_by: args.actor ?? "mcp"
          });
        } catch (error) {
          dispatchResult = "fail";
          dispatchDetail = `dispatch failed: ${error instanceof Error ? error.message : String(error)}`;
          logger.error("failed to cache mcp action state", error instanceof Error ? error.message : error);
        }

        const persisted = await query(
          `UPDATE actions
           SET result = $2, detail = $3
           WHERE id = $1
           RETURNING id, incident_id, action_type, scope, target, ttl_seconds, result, detail, created_at, executed_at`,
          [result.rows[0].id, dispatchResult, dispatchDetail]
        );

        const executionView = await getActionExecutionView(result.rows[0].id);

        res.json({ data: { ...persisted.rows[0], redis_key: redisKey, ...(executionView ?? {}) } });
        return;
      }

      case "rollback_action": {
        const origin = await query<{
          incident_id: string;
          action_type: ManagedActionType | "rollback";
          scope: ManagedActionScope;
          target: string;
        }>(
          "SELECT incident_id, action_type, scope, target FROM actions WHERE id = $1 LIMIT 1",
          [args.action_id]
        );
        if (origin.rowCount === 0) {
          throw new HttpError(404, "action not found");
        }
        const rollback = await query(
          `INSERT INTO actions (
             incident_id, action_type, scope, target, ttl_seconds, requested_by,
             executed_by, result, detail, rollback_token, executed_at
           ) VALUES ($1, 'rollback', $2, $3, 0, 'mcp', 'mcp', 'pending', $4, $5, NOW())
           RETURNING id, incident_id, action_type, scope, target, result, created_at, executed_at`,
          [
            origin.rows[0].incident_id,
            origin.rows[0].scope,
            origin.rows[0].target,
            `rollback for ${args.action_id}`,
            `rbk:${args.action_id}:${Date.now()}`
          ]
        );
        let redisCleared = false;
        let redisKey: string | null = null;
        let rollbackResult: "success" | "fail" = "success";
        let rollbackDetail = `rollback for ${args.action_id}`;

        if (origin.rows[0].action_type !== "rollback") {
          try {
            const cleared = await clearActiveActionState({
              scope: origin.rows[0].scope,
              action_type: origin.rows[0].action_type,
              target: origin.rows[0].target
            });
            redisCleared = cleared.deleted > 0;
            redisKey = cleared.key;
          } catch (error) {
            rollbackResult = "fail";
            rollbackDetail = `rollback dispatch failed: ${error instanceof Error ? error.message : String(error)}`;
            logger.error("failed to clear mcp action state", error instanceof Error ? error.message : error);
          }
        }

        const persisted = await query(
          `UPDATE actions
           SET result = $2, detail = $3
           WHERE id = $1
           RETURNING id, incident_id, action_type, scope, target, result, detail, created_at, executed_at`,
          [rollback.rows[0].id, rollbackResult, rollbackDetail]
        );

        const executionView = await getActionExecutionView(rollback.rows[0].id);

        res.json({
          data: {
            ...persisted.rows[0],
            redis_key: redisKey,
            redis_cleared: redisCleared,
            ...(executionView ?? {})
          }
        });
        return;
      }

      case "create_approval_request": {
        const result = await query(
          `INSERT INTO approvals (incident_id, action_draft, risk_level, status, requested_by, comment)
           VALUES ($1, $2, $3, 'pending', $4, $5)
           RETURNING id, incident_id, action_draft, risk_level, status, requested_by, created_at`,
          [
            args.incident_id,
            JSON.stringify(args.action_plan ?? {}),
            args.risk_level ?? "high",
            args.requested_by ?? "mcp",
            args.justification ?? null
          ]
        );
        res.json({ data: result.rows[0] });
        return;
      }

      case "capture_pcap": {
        const now = new Date();
        const minutes = Number(args.time_window ?? 5);
        const start = new Date(now.getTime() - minutes * 60 * 1000);
        const pcapUri = `storage/pcap/incident-${args.incident_id}-${Date.now()}.pcap`;

        const result = await query(
          `INSERT INTO forensics (incident_id, ts_start, ts_end, filter, pcap_uri, status)
           VALUES ($1, $2, $3, $4, $5, 'queued')
           RETURNING id, incident_id, ts_start, ts_end, filter, pcap_uri, status, created_at`,
          [args.incident_id, start.toISOString(), now.toISOString(), args.filter_expr ?? null, pcapUri]
        );
        res.json({ data: result.rows[0] });
        return;
      }

      case "get_forensics": {
        const result = await query(
          `SELECT id, incident_id, ts_start, ts_end, filter, pcap_uri, sha256, size_bytes, status, created_at
           FROM forensics
           WHERE incident_id = $1
           ORDER BY created_at DESC`,
          [args.incident_id]
        );
        res.json({ data: result.rows });
        return;
      }

      case "get_pcap_meta": {
        const result = await query(
          `SELECT id, incident_id, ts_start, ts_end, filter, pcap_uri, sha256, size_bytes, status, created_at, completed_at
           FROM forensics
           WHERE id = $1
           LIMIT 1`,
          [args.fid]
        );
        res.json({ data: result.rows[0] ?? null });
        return;
      }

      default:
        throw new HttpError(400, `unsupported tool: ${input.tool}`);
    }
  })
);
