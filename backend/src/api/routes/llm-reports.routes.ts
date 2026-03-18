import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { query } from "../../core/db/pool";
import { analyzeEventsFromRaw } from "../../services/orchestration/analyze-events";

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
  limit: z.number().int().positive().max(500).default(100),
  requested_by: z.string().default("analyst")
});

export const llmReportsRouter = Router();

llmReportsRouter.post(
  "/analyze-events",
  asyncHandler(async (req, res) => {
    const input = analyzeEventsSchema.parse(req.body);
    const result = await analyzeEventsFromRaw(input);
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
