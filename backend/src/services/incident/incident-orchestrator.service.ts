import { HttpError } from "../../core/http/http-error";
import { pool, query } from "../../core/db/pool";
import { logger } from "../../core/logger";
import { analyzeIncidentWithLlmApi } from "../llm/incident-analyzer";
import { cacheActiveActionState } from "../policy/action-state";

interface EventRow {
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
}

interface AnalyzeByFiltersInput {
  asset_id?: string;
  src_ip?: string;
  limit: number;
  requested_by: string;
}

interface AnalyzeByEventIdsInput {
  event_ids: Array<number | string>;
  requested_by: string;
}

interface AnalyzeIncidentResult {
  incident: {
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
  };
  alert: Record<string, unknown>;
  llm_report: Record<string, unknown>;
  llm_meta: Awaited<ReturnType<typeof analyzeIncidentWithLlmApi>>["meta"];
  source_events: number;
}

const fetchEventsByFilters = async (input: AnalyzeByFiltersInput): Promise<EventRow[]> => {
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

  const eventsResult = await query<EventRow>(
    `SELECT id, ts::text, asset_id::text, src_ip::text, method, uri, status, rule_id, rule_msg, rule_score, waf_action
     FROM events_raw
     ${where}
     ORDER BY ts DESC
     LIMIT $${params.length}`,
    params
  );

  return eventsResult.rows;
};

const fetchEventsByIds = async (eventIds: number[]): Promise<EventRow[]> => {
  const placeholders = eventIds.map((_, index) => `$${index + 1}`).join(", ");
  const eventsResult = await query<EventRow>(
    `SELECT id, ts::text, asset_id::text, src_ip::text, method, uri, status, rule_id, rule_msg, rule_score, waf_action
     FROM events_raw
     WHERE id IN (${placeholders})
     ORDER BY ts DESC`,
    eventIds
  );

  return eventsResult.rows;
};

const persistAnalysis = async (events: EventRow[], requestedBy: string, preferredAssetId?: string | null) => {
  if (events.length === 0) {
    throw new HttpError(404, "no events available for analysis");
  }

  const ascendingByTs = [...events].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const firstSeen = ascendingByTs[0].ts;
  const lastSeen = ascendingByTs[ascendingByTs.length - 1].ts;

  const uniqueAssetIds = [...new Set(events.map((event) => event.asset_id).filter(Boolean))];
  const uniqueSrcIps = [...new Set(events.map((event) => event.src_ip).filter(Boolean))];

  const incidentAssetId = preferredAssetId ?? (uniqueAssetIds.length === 1 ? uniqueAssetIds[0] : null);
  const incidentSrcIp = uniqueSrcIps.length > 0 ? uniqueSrcIps[0] : null;
  const maxRuleScore = Math.max(0, ...events.map((event) => event.rule_score ?? 0));

  const llmResult = await analyzeIncidentWithLlmApi({
    requested_by: requestedBy,
    asset_id: incidentAssetId,
    src_ip: incidentSrcIp,
    events
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const incidentResult = await client.query<AnalyzeIncidentResult["incident"]>(
      `INSERT INTO incidents (asset_id, title, severity, status, first_seen, last_seen, src_ip, summary)
       VALUES ($1, $2, $3, 'open', $4, $5, $6, $7)
       RETURNING id, asset_id::text, title, severity, status, first_seen::text, last_seen::text, src_ip::text, summary, created_at::text, updated_at::text`,
      [
        incidentAssetId,
        llmResult.analysis.title,
        llmResult.analysis.severity,
        firstSeen,
        lastSeen,
        incidentSrcIp,
        llmResult.analysis.summary
      ]
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
        llmResult.analysis.title,
        llmResult.analysis.severity,
        maxRuleScore,
        firstSeen,
        lastSeen,
        events.length,
        llmResult.analysis.summary
      ]
    );

    const reportResult = await client.query(
      `INSERT INTO llm_reports (
         incident_id, model, task, prompt_version, prompt_digest, input_digest,
         attack_chain, key_iocs, risk_assessment, recommended_actions_low,
         recommended_actions_high, confidence
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, incident_id::text, model, task, prompt_version, prompt_digest, input_digest,
                 attack_chain, key_iocs, risk_assessment, recommended_actions_low,
                 recommended_actions_high, confidence, created_at::text`,
      [
        incident.id,
        llmResult.meta.report_model,
        llmResult.meta.task,
        llmResult.meta.prompt_version,
        llmResult.meta.prompt_digest,
        llmResult.meta.input_digest,
        JSON.stringify(llmResult.analysis.attack_chain),
        JSON.stringify(llmResult.analysis.key_iocs),
        JSON.stringify(llmResult.analysis.risk_assessment),
        JSON.stringify(llmResult.analysis.recommended_actions_low),
        JSON.stringify(llmResult.analysis.recommended_actions_high),
        llmResult.analysis.confidence ?? null
      ]
    );

    await client.query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        requestedBy,
        "llm_analysis_completed",
        "incident",
        incident.id,
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

    await client.query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        requestedBy,
        "llm_incident_generated",
        "incident",
        incident.id,
        JSON.stringify({
          source_events: events.length,
          generated_alert_id: alertResult.rows[0].id,
          generated_report_id: reportResult.rows[0].id,
          llm_provider: llmResult.meta.provider,
          llm_degraded: llmResult.meta.degraded,
          llm_report_model: llmResult.meta.report_model
        })
      ]
    );

    await client.query("COMMIT");

    // 策略引擎：根据事件严重度和激活策略自动创建审批单或直接执行动作
    setImmediate(async () => {
      try {
        await applyPolicyActions({
          incidentId: incident.id,
          severity: incident.severity as "low" | "med" | "high",
          srcIp: incidentSrcIp,
          requestedBy
        });
      } catch (policyErr) {
        logger.warn("policy auto-action failed (non-critical)", {
          incident_id: incident.id,
          error: policyErr instanceof Error ? policyErr.message : String(policyErr)
        });
      }
    });

    return {
      incident,
      alert: alertResult.rows[0],
      llm_report: reportResult.rows[0],
      llm_meta: llmResult.meta,
      source_events: events.length
    } satisfies AnalyzeIncidentResult;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

type PolicyRow = {
  risk_threshold_low: number;
  risk_threshold_high: number;
  low_risk_actions: string[];
  high_risk_actions: string[];
  default_ttl_seconds: number;
};

const SEVERITY_SCORE: Record<string, number> = { low: 10, med: 50, high: 90 };

const applyPolicyActions = async (params: {
  incidentId: string;
  severity: "low" | "med" | "high";
  srcIp: string | null;
  requestedBy: string;
}): Promise<void> => {
  const { incidentId, severity, srcIp, requestedBy } = params;

  // 读取第一条激活策略
  const policyResult = await query<PolicyRow>(
    `SELECT risk_threshold_low, risk_threshold_high, low_risk_actions,
            high_risk_actions, default_ttl_seconds
     FROM policies WHERE is_active = true ORDER BY created_at LIMIT 1`
  );

  if (policyResult.rowCount === 0) return;

  const policy = policyResult.rows[0];
  const score = SEVERITY_SCORE[severity] ?? 10;
  const isHighRisk = score >= policy.risk_threshold_high;
  const isMedRisk = !isHighRisk && score >= policy.risk_threshold_low;

  if (!isHighRisk && !isMedRisk) return;

  const actionTypes = isHighRisk
    ? (policy.high_risk_actions as string[])
    : (policy.low_risk_actions as string[]);

  if (!actionTypes || actionTypes.length === 0) return;

  const target = srcIp ?? "unknown";
  const ttl = policy.default_ttl_seconds;

  if (isHighRisk) {
    // 高风险 → 为每个动作类型创建审批单
    for (const actionType of actionTypes) {
      if (!["rate_limit", "block", "challenge"].includes(actionType)) continue;

      await query(
        `INSERT INTO approvals (incident_id, action_draft, risk_level, status, requested_by, comment)
         VALUES ($1, $2, $3, 'pending', $4, $5)`,
        [
          incidentId,
          JSON.stringify({ action_type: actionType, scope: "ip", target, ttl_seconds: ttl, requested_by: requestedBy }),
          severity === "high" ? "high" : "med",
          requestedBy,
          `Auto-generated by policy engine. Severity: ${severity}, Action: ${actionType}`
        ]
      );

      logger.info("policy engine: approval created", { incident_id: incidentId, action_type: actionType, severity });
    }
  } else {
    // 中/低风险 → 直接执行允许直接执行的动作（rate_limit/challenge）
    for (const actionType of actionTypes) {
      if (!["rate_limit", "challenge"].includes(actionType)) continue;

      const actionResult = await query(
        `INSERT INTO actions (incident_id, action_type, scope, target, ttl_seconds, requested_by,
           executed_by, result, detail, rollback_token, executed_at)
         VALUES ($1, $2, 'ip', $3, $4, $5, 'policy-engine', 'success', $6, $7, NOW())
         RETURNING id`,
        [
          incidentId,
          actionType,
          target,
          ttl,
          requestedBy,
          `Auto-executed by policy engine. Severity: ${severity}`,
          `rbk:policy:${incidentId}:${Date.now()}`
        ]
      );

      const actionId = actionResult.rows[0].id as string;

      // 同步到 Redis 供 WAF 消费
      try {
        await cacheActiveActionState({
          action_id: actionId,
          incident_id: incidentId,
          action_type: actionType as "rate_limit" | "challenge",
          scope: "ip",
          target,
          ttl_seconds: ttl,
          requested_by: requestedBy,
          executed_by: "policy-engine"
        });
      } catch (redisErr) {
        logger.warn("policy engine: redis cache failed", { action_id: actionId, error: String(redisErr) });
      }

      logger.info("policy engine: action executed", { incident_id: incidentId, action_type: actionType, severity });
    }
  }
};

export const incidentOrchestratorService = {
  analyzeByFilters: async (input: AnalyzeByFiltersInput): Promise<AnalyzeIncidentResult> => {
    const events = await fetchEventsByFilters(input);
    return persistAnalysis(events, input.requested_by, input.asset_id ?? null);
  },

  analyzeByEventIds: async (input: AnalyzeByEventIdsInput): Promise<AnalyzeIncidentResult> => {
    const uniqueEventIds = [
      ...new Set(
        input.event_ids
          .map((id) => (typeof id === "number" ? id : Number.parseInt(String(id), 10)))
          .filter((id) => Number.isSafeInteger(id) && id > 0)
      )
    ];

    if (uniqueEventIds.length === 0) {
      throw new HttpError(400, "event_ids must be a non-empty array of positive integers");
    }

    const events = await fetchEventsByIds(uniqueEventIds);
    return persistAnalysis(events, input.requested_by);
  }
};
