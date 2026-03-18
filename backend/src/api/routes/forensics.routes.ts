import path from "node:path";
import { createHmac } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import { env } from "../../core/config/env";
import { query } from "../../core/db/pool";

const captureSchema = z.object({
  ts_start: z.string().datetime().optional(),
  ts_end: z.string().datetime().optional(),
  filter: z.string().optional(),
  requested_by: z.string().default("analyst")
});

export const forensicsRouter = Router();

const downloadTokenSchema = z.object({
  token: z.string().min(1)
});

const buildDownloadToken = (forensicsId: string, exp: number) => {
  const payload = `${forensicsId}.${exp}`;
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const secret = env.FORENSICS_DOWNLOAD_SECRET ?? env.JWT_SECRET;
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("hex");
  return `${encodedPayload}.${signature}`;
};

const verifyDownloadToken = (token: string, forensicsId: string) => {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new HttpError(401, "invalid download token");
  }

  const secret = env.FORENSICS_DOWNLOAD_SECRET ?? env.JWT_SECRET;
  const expected = createHmac("sha256", secret).update(encodedPayload).digest("hex");
  if (signature !== expected) {
    throw new HttpError(401, "invalid download token");
  }

  const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const [fid, expRaw] = decoded.split(".");
  const exp = Number(expRaw);

  if (fid !== forensicsId || Number.isNaN(exp)) {
    throw new HttpError(401, "invalid download token");
  }

  const now = Math.floor(Date.now() / 1000);
  if (exp < now) {
    throw new HttpError(401, "download token expired");
  }
};

const resolveAndValidatePcapPath = (pcapUri: string) => {
  const pcapBase = path.resolve(env.PCAP_DIR);
  const resolved = path.resolve(pcapUri);
  const normalizedBase = pcapBase.endsWith(path.sep) ? pcapBase : `${pcapBase}${path.sep}`;

  if (!(resolved === pcapBase || resolved.startsWith(normalizedBase))) {
    throw new HttpError(400, "invalid pcap path");
  }

  return resolved;
};

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
    const result = await query<{
      id: string;
      incident_id: string;
      ts_start: string;
      ts_end: string;
      filter: string | null;
      pcap_uri: string | null;
      sha256: string | null;
      size_bytes: number | null;
      status: "queued" | "capturing" | "completed" | "failed";
      error_message: string | null;
      created_at: string;
      completed_at: string | null;
    }>(
      `SELECT id, incident_id, ts_start, ts_end, filter, pcap_uri, sha256, size_bytes, status, error_message, created_at, completed_at
       FROM forensics
       WHERE id = $1
       LIMIT 1`,
      [req.params.fid]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "forensics record not found" });
      return;
    }

    const record = result.rows[0];
    if (record.status !== "completed") {
      res.status(409).json({
        error: "forensics is not ready for download",
        status: record.status,
        error_message: record.error_message
      });
      return;
    }

    if (!record.pcap_uri) {
      res.status(404).json({ error: "pcap file path not found" });
      return;
    }

    const resolvedPath = resolveAndValidatePcapPath(record.pcap_uri);
    if (!existsSync(resolvedPath)) {
      await query(
        `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "system",
          "forensics_download_missing",
          "forensics",
          record.id,
          JSON.stringify({ pcap_uri: record.pcap_uri })
        ]
      );

      res.status(404).json({ error: "pcap file not found" });
      return;
    }

    const ttl = env.FORENSICS_DOWNLOAD_TTL_SECONDS;
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const token = buildDownloadToken(record.id, expiresAt);
    const fileName = path.basename(resolvedPath);

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        "system",
        "forensics_download_issued",
        "forensics",
        record.id,
        JSON.stringify({ expires_at: new Date(expiresAt * 1000).toISOString(), ttl_seconds: ttl })
      ]
    );

    res.json({
      ...record,
      download_url: `/api/forensics/${record.id}/file?token=${encodeURIComponent(token)}`,
      expires_at: new Date(expiresAt * 1000).toISOString(),
      file_name: fileName
    });
  })
);

forensicsRouter.get(
  "/forensics/:fid/file",
  asyncHandler(async (req, res) => {
    const { token } = downloadTokenSchema.parse(req.query);
    verifyDownloadToken(token, req.params.fid);

    const result = await query<{
      id: string;
      pcap_uri: string | null;
      status: "queued" | "capturing" | "completed" | "failed";
    }>(
      `SELECT id, pcap_uri, status
       FROM forensics
       WHERE id = $1
       LIMIT 1`,
      [req.params.fid]
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "forensics record not found");
    }

    const record = result.rows[0];
    if (record.status !== "completed") {
      throw new HttpError(409, "forensics is not ready for download");
    }

    if (!record.pcap_uri) {
      throw new HttpError(404, "pcap file path not found");
    }

    const resolvedPath = resolveAndValidatePcapPath(record.pcap_uri);
    if (!existsSync(resolvedPath)) {
      throw new HttpError(404, "pcap file not found");
    }

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      ["system", "forensics_file_downloaded", "forensics", record.id, JSON.stringify({})]
    );

    res.setHeader("Content-Type", "application/vnd.tcpdump.pcap");
    res.setHeader("Content-Disposition", `attachment; filename=\"${path.basename(resolvedPath)}\"`);
    createReadStream(resolvedPath).pipe(res);
  })
);
