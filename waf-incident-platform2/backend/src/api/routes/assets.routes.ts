import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { query } from "../../core/db/pool";

const createAssetSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  entrypoint: z.string().optional(),
  environment: z.string().default("prod"),
  metadata: z.record(z.any()).default({})
});

export const assetsRouter = Router();

assetsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await query(
      "SELECT id, name, domain, entrypoint, environment, metadata, created_at, updated_at FROM assets ORDER BY created_at DESC"
    );
    res.json({ items: result.rows });
  })
);

assetsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createAssetSchema.parse(req.body);
    const result = await query(
      `INSERT INTO assets (name, domain, entrypoint, environment, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, domain, entrypoint, environment, metadata, created_at, updated_at`,
      [input.name, input.domain ?? null, input.entrypoint ?? null, input.environment, JSON.stringify(input.metadata)]
    );
    res.status(201).json(result.rows[0]);
  })
);
