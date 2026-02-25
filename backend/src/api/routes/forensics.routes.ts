import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { env } from "../../core/config/env";
import { query } from "../../core/db/pool";

const captureSchema = z.object({
  ts_start: z.string().datetime().optional(),
  ts_end: z.string().datetime().optional(),
  filter: z.string().optional(),
  requested_by: z.string().default("analyst")
});

export const forensicsRouter = Router();

forensicsRouter.post(
  "/incidents/:id/forensics/capture",
  asyncHandler(async (req, res) => {
    const incidentId = req.params.id;
    const input = captureSchema.parse(req.body);

    const end = input.ts_end ? new Date(input.ts_end) : new Date();
    const start = input.ts_start
      ? new Date(input.ts_start)
      : new Date(end.getTime() - env.DEFAULT_CAPTURE_WINDOW_MINUTES * 60 * 1000);

    const fileName = `incident-${incidentId}-${Date.now()}.pcap`;
    const pcapUri = path.join(env.PCAP_DIR, fileName).replace(/\\/g, "/");

    const result = await query(
      `INSERT INTO forensics (incident_id, ts_start, ts_end, filter, pcap_uri, status)
       VALUES ($1, $2, $3, $4, $5, 'queued')
       RETURNING id, incident_id, ts_start, ts_end, filter, pcap_uri, status, created_at`,
      [incidentId, start.toISOString(), end.toISOString(), input.filter ?? null, pcapUri]
    );

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.requested_by,
        "forensics_capture_requested",
        "incident",
        incidentId,
        JSON.stringify({ forensics_id: result.rows[0].id, filter: input.filter ?? null })
      ]
    );

    res.status(201).json(result.rows[0]);
  })
);

forensicsRouter.get(
  "/incidents/:id/forensics",
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, incident_id, ts_start, ts_end, filter, pcap_uri, sha256, size_bytes, status, error_message, created_at, completed_at
       FROM forensics
       WHERE incident_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({ items: result.rows });
  })
);

forensicsRouter.get(
  "/forensics/:fid/download",
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, incident_id, ts_start, ts_end, filter, pcap_uri, sha256, size_bytes, status, created_at, completed_at
       FROM forensics
       WHERE id = $1
       LIMIT 1`,
      [req.params.fid]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "forensics record not found" });
      return;
    }

    res.json({
      ...result.rows[0],
      download_hint: "MVP 返回元数据，后续可替换为对象存储签名 URL"
    });
  })
);
