import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { query } from "../../core/db/pool";
import { cidrContainsIp, invalidateWhitelistCache } from "../../services/policy/ip-whitelist.service";

const CIDR_REGEX = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

const entrySchema = z.object({
  name: z.string().min(1).max(120),
  cidr: z.string().min(7).regex(CIDR_REGEX, "无效的 IP 或 CIDR 格式（示例：1.2.3.4 或 203.0.113.0/24）"),
  description: z.string().max(500).optional(),
  is_active: z.boolean().default(true)
});

export const ipWhitelistRouter = Router();

ipWhitelistRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await query(
      `SELECT id, name, cidr, description, is_active, created_at, updated_at
       FROM ip_whitelist_entries ORDER BY created_at DESC`
    );
    res.json({ items: result.rows });
  })
);

ipWhitelistRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = entrySchema.parse(req.body);

    const duplicate = await query(
      `SELECT id FROM ip_whitelist_entries WHERE cidr = $1 LIMIT 1`,
      [input.cidr]
    );
    if (duplicate.rowCount && duplicate.rowCount > 0) {
      throw new HttpError(409, `CIDR ${input.cidr} 已存在于白名单中`);
    }

    const result = await query(
      `INSERT INTO ip_whitelist_entries (name, cidr, description, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, cidr, description, is_active, created_at, updated_at`,
      [input.name, input.cidr, input.description ?? null, input.is_active]
    );

    invalidateWhitelistCache();
    res.status(201).json(result.rows[0]);
  })
);

ipWhitelistRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = entrySchema.parse(req.body);

    const result = await query(
      `UPDATE ip_whitelist_entries
       SET name = $1, cidr = $2, description = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, cidr, description, is_active, created_at, updated_at`,
      [input.name, input.cidr, input.description ?? null, input.is_active, req.params.id]
    );

    if (result.rowCount === 0) throw new HttpError(404, "白名单条目不存在");
    invalidateWhitelistCache();
    res.json(result.rows[0]);
  })
);

ipWhitelistRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await query(
      `DELETE FROM ip_whitelist_entries WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (result.rowCount === 0) throw new HttpError(404, "白名单条目不存在");
    invalidateWhitelistCache();
    res.json({ deleted: true });
  })
);

ipWhitelistRouter.post(
  "/check",
  asyncHandler(async (req, res) => {
    const { ip } = z.object({ ip: z.string().min(7) }).parse(req.body);

    const result = await query(
      `SELECT id, name, cidr FROM ip_whitelist_entries WHERE is_active = true`
    );
    const matched = result.rows.find((row) => cidrContainsIp(row.cidr as string, ip));

    res.json({ ip, whitelisted: Boolean(matched), matched_entry: matched ?? null });
  })
);
