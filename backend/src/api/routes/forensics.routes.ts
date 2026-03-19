import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { env } from "../../core/config/env";
import { query } from "../../core/db/pool";
import { logger } from "../../core/logger";

const captureSchema = z.object({
  ts_start: z.string().datetime().optional(),
  ts_end: z.string().datetime().optional(),
  filter: z.string().optional(),
  requested_by: z.string().default("analyst")
});

const workerStatusSchema = z.object({
  status: z.enum(["capturing", "completed", "failed"]),
  sha256: z.string().length(64).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  error_message: z.string().optional()
});

const resolvePcapFilePath = (pcapUri: string): string => {
  const normalized = path.normalize(pcapUri);
  const root = path.resolve(env.PCAP_DIR);
  const absolute = path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
  const relative = path.relative(root, absolute);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("pcap path escapes PCAP_DIR");
  }

  return absolute;
};

const signDownloadToken = (forensicsId: string, expiresAtMs: number): string => {
  const payload = `${forensicsId}:${expiresAtMs}`;
  const signature = crypto
    .createHmac("sha256", env.FORENSICS_DOWNLOAD_SIGNING_SECRET)
    .update(payload)
    .digest("base64url");

  return `${expiresAtMs}.${signature}`;
};

const verifyDownloadToken = (forensicsId: string, token: string): boolean => {
  const [expiresAtRaw, signature] = token.split(".");

  if (!expiresAtRaw || !signature) {
    return false;
  }

  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", env.FORENSICS_DOWNLOAD_SIGNING_SECRET)
    .update(`${forensicsId}:${expiresAtMs}`)
    .digest("base64url");

  return expected === signature;
};

const markForensicsFailed = async (forensicsId: string, errorMessage: string): Promise<void> => {
  await query(
    `UPDATE forensics
     SET status = 'failed', error_message = $1, completed_at = NOW()
     WHERE id = $2`,
    [errorMessage, forensicsId]
  );
};

const triggerForensicsCapture = async (params: {
  forensicsId: string;
  incidentId: string;
  pcapUri: string;
  filter: string | null;
  durationSeconds: number;
}): Promise<void> => {
  await query("UPDATE forensics SET status = 'capturing' WHERE id = $1", [params.forensicsId]);

  const workerPath = path.resolve(process.cwd(), "../services/forensics-worker/src/capture.py");
  const outputPath = resolvePcapFilePath(params.pcapUri);
  const outputDir = path.dirname(outputPath);

  const args = [
    workerPath,
    "--interface",
    "any",
    "--duration",
    String(params.durationSeconds),
    "--output-dir",
    outputDir,
    "--output-file",
    path.basename(outputPath),
    "--task-id",
    params.forensicsId,
    "--incident-id",
    params.incidentId,
    "--backend-url",
    env.BACKEND_API_URL
  ];

  if (params.filter) {
    args.push("--filter", params.filter);
  }

  const worker = spawn(env.FORENSICS_PYTHON_BIN, args, {
    env: { ...process.env, PYTHONUNBUFFERED: "1" }
  });

  let stderr = "";
  worker.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  worker.on("close", (code) => {
    if (code === 0) {
      return;
    }

    const errorMessage = `capture worker exited with code ${code}: ${stderr || "no stderr"}`;
    logger.error("forensics capture worker failed", {
      forensics_id: params.forensicsId,
      error: errorMessage
    });
    void markForensicsFailed(params.forensicsId, errorMessage);
  });

  worker.on("error", (error) => {
    const errorMessage = `capture worker spawn failed: ${error.message}`;
    logger.error("forensics capture worker spawn failed", {
      forensics_id: params.forensicsId,
      error: errorMessage
    });
    void markForensicsFailed(params.forensicsId, errorMessage);
  });
};

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

    const record = result.rows[0];
    res.status(201).json(record);

    const durationSeconds = Math.max(
      1,
      Math.floor((new Date(record.ts_end).getTime() - new Date(record.ts_start).getTime()) / 1000)
    );

    setImmediate(() => {
      void triggerForensicsCapture({
        forensicsId: record.id,
        incidentId,
        pcapUri: record.pcap_uri,
        filter: record.filter,
        durationSeconds
      }).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("forensics capture trigger failed", {
          forensics_id: record.id,
          error: errorMessage
        });
        void markForensicsFailed(record.id, errorMessage);
      });
    });
  })
);

forensicsRouter.patch(
  "/forensics/:fid/status",
  asyncHandler(async (req, res) => {
    const payload = workerStatusSchema.parse(req.body);

    const updates: string[] = ["status = $1"];
    const values: unknown[] = [payload.status];

    if (payload.status === "completed") {
      if (payload.sha256) {
        updates.push(`sha256 = $${values.length + 1}`);
        values.push(payload.sha256);
      }
      if (payload.size_bytes !== undefined) {
        updates.push(`size_bytes = $${values.length + 1}`);
        values.push(payload.size_bytes);
      }
      updates.push("completed_at = NOW()", "error_message = NULL");
    }

    if (payload.status === "failed") {
      updates.push(`error_message = $${values.length + 1}`);
      values.push(payload.error_message ?? "capture failed");
      updates.push("completed_at = NOW()");
    }

    const idPlaceholder = `$${values.length + 1}`;
    values.push(req.params.fid);

    const result = await query(
      `UPDATE forensics SET ${updates.join(", ")} WHERE id = ${idPlaceholder}
       RETURNING id, incident_id, ts_start, ts_end, filter, pcap_uri, sha256, size_bytes, status, error_message, created_at, completed_at`,
      values
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "forensics record not found" });
      return;
    }

    res.json(result.rows[0]);
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
  "/forensics/:fid",
  asyncHandler(async (req, res) => {
    const result = await query(
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
    const response = { ...record } as Record<string, unknown>;

    if (record.status === "completed") {
      const expiresAtMs = Date.now() + env.FORENSICS_DOWNLOAD_URL_TTL_SECONDS * 1000;
      const token = signDownloadToken(record.id, expiresAtMs);
      response.download_url = `/api/forensics/${record.id}/download?token=${token}`;
      response.expires_at = new Date(expiresAtMs).toISOString();
    }

    res.json(response);
  })
);

forensicsRouter.get(
  "/forensics/:fid/download",
  asyncHandler(async (req, res) => {
    const result = await query(
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
        error: "pcap not ready",
        status: record.status,
        message: record.status === "failed" ? record.error_message : "capture is still in progress"
      });
      return;
    }

    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (env.FORENSICS_DOWNLOAD_TOKEN_REQUIRED && !verifyDownloadToken(record.id, token)) {
      res.status(401).json({ error: "invalid or expired download token" });
      return;
    }

    const pcapPath = resolvePcapFilePath(record.pcap_uri);
    if (!fs.existsSync(pcapPath)) {
      res.status(404).json({ error: "pcap file not found" });
      return;
    }

    const stat = fs.statSync(pcapPath);

    res.setHeader("Content-Type", "application/vnd.tcpdump.pcap");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(pcapPath)}"`);
    res.setHeader("Content-Length", String(stat.size));
    if (record.sha256) {
      res.setHeader("X-Pcap-Sha256", record.sha256);
    }
    res.setHeader("X-Forensics-Id", record.id);

    fs.createReadStream(pcapPath).pipe(res);
  })
);
