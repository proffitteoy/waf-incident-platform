import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";
import { parseLimit, parseOffset } from "../../core/http/query-utils";
import { incidentOrchestratorService } from "../../services/incident/incident-orchestrator.service";

const reportSchema = z.object({
  model: z.string().default("manual"),
  task: z.string().optional(),
  prompt_version: z.string().optional(),
  prompt_digest: z.string().optional(),
  input_digest: z.string().optional(),
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
  event_ids: z.array(z.number().int().positive()).max(500).optional(),
  limit: z.number().int().positive().max(500).default(100),
  requested_by: z.string().default("analyst")
});

export const llmReportsRouter = Router();

export const llmGlobalRouter = Router();

llmGlobalRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT lr.id, lr.incident_id, lr.model, lr.task, lr.prompt_version, lr.prompt_digest,
              lr.input_digest, lr.attack_chain, lr.key_iocs, lr.risk_assessment,
              lr.recommended_actions_low, lr.recommended_actions_high, lr.confidence, lr.created_at,
              i.title AS incident_title, i.severity, i.src_ip
       FROM llm_reports lr
       LEFT JOIN incidents i ON i.id = lr.incident_id
       WHERE lr.id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      throw new HttpError(404, "report not found");
    }
    res.json(result.rows[0]);
  })
);

llmGlobalRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit as string | undefined, 200);
    const offset = parseOffset(req.query.offset as string | undefined);

    const filterParams: unknown[] = [];
    const conditions: string[] = [];

    if (req.query.incident_id) {
      filterParams.push(req.query.incident_id);
      conditions.push(`lr.incident_id::text = $${filterParams.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await query(
      `SELECT COUNT(*) FROM llm_reports lr ${where}`,
      filterParams
    );
    const total = Number(countResult.rows[0].count);

    const dataParams = [...filterParams, limit, offset];
    const dataResult = await query(
      `SELECT lr.id, lr.incident_id, lr.model, lr.task, lr.confidence, lr.created_at,
              i.title AS incident_title, i.severity, i.src_ip
       FROM llm_reports lr
       LEFT JOIN incidents i ON i.id = lr.incident_id
       ${where}
       ORDER BY lr.created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    res.json({ items: dataResult.rows, total, limit, offset });
  })
);

llmReportsRouter.post(
  "/analyze-events",
  asyncHandler(async (req, res) => {
    const input = analyzeEventsSchema.parse(req.body);

    const result = input.event_ids
      ? await incidentOrchestratorService.analyzeByEventIds({
          event_ids: input.event_ids,
          requested_by: input.requested_by
        })
      : await incidentOrchestratorService.analyzeByFilters({
          asset_id: input.asset_id,
          src_ip: input.src_ip,
          limit: input.limit,
          requested_by: input.requested_by
        });

    res.status(201).json(result);
  })
);

llmReportsRouter.get(
  "/:id/llm-reports",
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, incident_id, model, task, prompt_version, prompt_digest, input_digest,
              attack_chain, key_iocs, risk_assessment, recommended_actions_low,
              recommended_actions_high, confidence, created_at
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
         incident_id, model, task, prompt_version, prompt_digest, input_digest,
         attack_chain, key_iocs, risk_assessment, recommended_actions_low,
         recommended_actions_high, confidence
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, incident_id, model, task, prompt_version, prompt_digest, input_digest,
                 attack_chain, key_iocs, risk_assessment,
                 recommended_actions_low, recommended_actions_high, confidence, created_at`,
      [
        req.params.id,
        input.model,
        input.task ?? null,
        input.prompt_version ?? null,
        input.prompt_digest ?? null,
        input.input_digest ?? null,
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
