import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";
import { invalidateGeoBlockCache, lookupCountry } from "../../services/policy/geo-block.service";

const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

const ruleSchema = z.object({
  name: z.string().min(1).max(120),
  country_codes: z
    .array(z.string().regex(COUNTRY_CODE_REGEX, "国家代码需为两位大写字母（ISO 3166-1）"))
    .min(1),
  description: z.string().max(500).optional(),
  is_active: z.boolean().default(true)
});

export const geoBlockRouter = Router();

geoBlockRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await query(
      `SELECT id, name, country_codes, description, is_active, created_at, updated_at
       FROM geo_block_rules ORDER BY created_at DESC`
    );
    res.json({ items: result.rows });
  })
);

geoBlockRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = ruleSchema.parse(req.body);

    const result = await query(
      `INSERT INTO geo_block_rules (name, country_codes, description, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, country_codes, description, is_active, created_at, updated_at`,
      [input.name, input.country_codes, input.description ?? null, input.is_active]
    );

    invalidateGeoBlockCache();
    res.status(201).json(result.rows[0]);
  })
);

geoBlockRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = ruleSchema.parse(req.body);

    const result = await query(
      `UPDATE geo_block_rules
       SET name = $1, country_codes = $2, description = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, country_codes, description, is_active, created_at, updated_at`,
      [input.name, input.country_codes, input.description ?? null, input.is_active, req.params.id]
    );

    if (result.rowCount === 0) throw new HttpError(404, "地区封禁规则不存在");
    invalidateGeoBlockCache();
    res.json(result.rows[0]);
  })
);

geoBlockRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await query(
      `DELETE FROM geo_block_rules WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (result.rowCount === 0) throw new HttpError(404, "地区封禁规则不存在");
    invalidateGeoBlockCache();
    res.json({ deleted: true });
  })
);

geoBlockRouter.post(
  "/lookup",
  asyncHandler(async (req, res) => {
    const { ip } = z.object({ ip: z.string().min(7) }).parse(req.body);
    const country = lookupCountry(ip);

    const blockedResult = country
      ? await query(
          `SELECT id, name FROM geo_block_rules
           WHERE is_active = true AND $1 = ANY(country_codes) LIMIT 1`,
          [country]
        )
      : null;

    const matchedRule = blockedResult?.rows[0] ?? null;

    res.json({ ip, country, geo_blocked: Boolean(matchedRule), matched_rule: matchedRule });
  })
);
