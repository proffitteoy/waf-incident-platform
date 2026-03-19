import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";

const updatePolicySchema = z.object({
  risk_threshold_low: z.number().int().nonnegative(),
  risk_threshold_high: z.number().int().positive(),
  low_risk_actions: z.array(z.string()),
  high_risk_actions: z.array(z.string()),
  default_ttl_seconds: z.number().int().positive(),
  is_active: z.boolean().default(true)
});

export const policiesRouter = Router();

policiesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await query(
      `SELECT id, asset_id, name, risk_threshold_low, risk_threshold_high, low_risk_actions,
              high_risk_actions, default_ttl_seconds, is_active, version, created_at, updated_at
       FROM policies ORDER BY is_active DESC, created_at DESC`
    );

    res.json({ items: result.rows });
  })
);

policiesRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updatePolicySchema.parse(req.body);

    if (input.risk_threshold_high <= input.risk_threshold_low) {
      throw new HttpError(400, "risk_threshold_high must be greater than risk_threshold_low");
    }

    const result = await query(
      `UPDATE policies
       SET risk_threshold_low = $1,
           risk_threshold_high = $2,
           low_risk_actions = $3,
           high_risk_actions = $4,
           default_ttl_seconds = $5,
           is_active = $6,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, asset_id, name, risk_threshold_low, risk_threshold_high, low_risk_actions,
                 high_risk_actions, default_ttl_seconds, is_active, version, created_at, updated_at`,
      [
        input.risk_threshold_low,
        input.risk_threshold_high,
        JSON.stringify(input.low_risk_actions),
        JSON.stringify(input.high_risk_actions),
        input.default_ttl_seconds,
        input.is_active,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "policy not found");
    }

    res.json(result.rows[0]);
  })
);
