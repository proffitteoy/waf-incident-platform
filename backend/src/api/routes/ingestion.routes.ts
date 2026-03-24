import { Router } from "express";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { env } from "../../core/config/env";
import { pool, query } from "../../core/db/pool";
import { logger } from "../../core/logger";
import { parseCorazaAuditJsonLine } from "../../services/ingestion/coraza-audit.parser";
import { incidentOrchestratorService } from "../../services/incident/incident-orchestrator.service";

const ingestCorazaSchema = z
  .object({
    asset_id: z.string().uuid().optional(),
    lines: z.array(z.string().min(2)).min(1).max(5000).optional(),
    lines_gzip_base64: z.string().min(1).optional()
  })
  .refine((input) => Array.isArray(input.lines) || typeof input.lines_gzip_base64 === "string", {
    message: "either lines or lines_gzip_base64 is required"
  });

const MAX_AUDIT_LINE_BYTES = 256 * 1024;
const MAX_DETAIL_TEXT = 2048;

const truncateText = (value: unknown, limit: number): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...[truncated ${value.length - limit} chars]`;
};

const compactOversizedAuditLine = (line: string): string => {
  if (Buffer.byteLength(line, "utf8") <= MAX_AUDIT_LINE_BYTES) {
    return line;
  }

  try {
    const payload = JSON.parse(line) as {
      transaction?: {
        time_stamp?: string;
        timestamp?: string;
        client_ip?: string;
        request?: { method?: string; uri?: string };
        response?: { http_code?: number | string; body?: unknown };
        producer?: unknown;
        interruption?: unknown;
        messages?: Array<{
          message?: unknown;
          details?: {
            ruleId?: unknown;
            message?: unknown;
            data?: unknown;
            severity?: unknown;
            tags?: unknown;
            match?: unknown;
          };
        }>;
      };
    };

    const tx = payload.transaction;
    if (!tx) {
      return line;
    }

    if (tx.response && Object.prototype.hasOwnProperty.call(tx.response, "body")) {
      tx.response.body = "[response body stripped for ingestion size control]";
    }

    if (Array.isArray(tx.messages)) {
      tx.messages = tx.messages.map((message) => ({
        ...message,
        message: truncateText(message.message, MAX_DETAIL_TEXT),
        details: message.details
          ? {
              ...message.details,
              message: truncateText(message.details.message, MAX_DETAIL_TEXT),
              data: truncateText(message.details.data, MAX_DETAIL_TEXT),
              match: truncateText(message.details.match, MAX_DETAIL_TEXT)
            }
          : undefined
      }));
    }

    const compact = JSON.stringify(payload);
    if (Buffer.byteLength(compact, "utf8") <= MAX_AUDIT_LINE_BYTES) {
      return compact;
    }

    const firstMessage = Array.isArray(tx.messages) && tx.messages.length > 0 ? tx.messages[0] : undefined;
    return JSON.stringify({
      transaction: {
        time_stamp: tx.time_stamp ?? tx.timestamp,
        client_ip: tx.client_ip,
        request: {
          method: tx.request?.method,
          uri: tx.request?.uri
        },
        response: {
          http_code: tx.response?.http_code
        },
        producer: tx.producer,
        interruption: tx.interruption,
        messages: firstMessage
          ? [
              {
                message: truncateText(firstMessage.message, MAX_DETAIL_TEXT),
                details: firstMessage.details
                  ? {
                      ruleId: firstMessage.details.ruleId,
                      message: truncateText(firstMessage.details.message, MAX_DETAIL_TEXT),
                      data: truncateText(firstMessage.details.data, MAX_DETAIL_TEXT),
                      severity: firstMessage.details.severity,
                      tags: Array.isArray(firstMessage.details.tags) ? firstMessage.details.tags.slice(0, 32) : []
                    }
                  : undefined
              }
            ]
          : []
      }
    });
  } catch {
    return line;
  }
};

const decodeCompressedLines = (base64Gzip: string): string[] => {
  const compressed = Buffer.from(base64Gzip, "base64");
  const raw = gunzipSync(compressed).toString("utf8");

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

export const ingestionRouter = Router();

ingestionRouter.post(
  "/ingestion/coraza/audit-lines",
  asyncHandler(async (req, res) => {
    const input = ingestCorazaSchema.parse(req.body);
    const triggeredAt = new Date().toISOString();

    const rawLines = Array.isArray(input.lines) ? input.lines : decodeCompressedLines(input.lines_gzip_base64 ?? "");
    const normalizedLines = rawLines.map((line) => compactOversizedAuditLine(line));

    const events = [];
    let droppedLines = 0;

    for (const line of normalizedLines) {
      try {
        events.push(...parseCorazaAuditJsonLine(line));
      } catch (error) {
        droppedLines += 1;
        logger.warn("ingestion skipped invalid audit line", {
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (events.length === 0) {
      res.json({ inserted: 0, parsed: 0, dropped_lines: droppedLines });
      return;
    }

    const client = await pool.connect();
    const insertedEventIds: number[] = [];

    try {
      await client.query("BEGIN");

      for (const event of events) {
        const insertResult = await client.query<{ id: number }>(
          `INSERT INTO events_raw (
             ts, asset_id, src_ip, method, uri, status,
             waf_engine, rule_id, rule_msg, rule_score, waf_action, tags
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            event.ts,
            input.asset_id ?? event.asset_id ?? null,
            event.src_ip ?? null,
            event.method ?? null,
            event.uri ?? null,
            event.status ?? null,
            event.waf_engine ?? "coraza",
            event.rule_id ?? null,
            event.rule_msg ?? null,
            event.rule_score ?? 0,
            event.waf_action ?? null,
            JSON.stringify(event.tags ?? {})
          ]
        );

        insertedEventIds.push(insertResult.rows[0].id);
      }

      await client.query("COMMIT");
      res.status(201).json({ inserted: events.length, parsed: events.length, dropped_lines: droppedLines });

      if (env.AUTO_ANALYZE_ON_INGEST && insertedEventIds.length > 0) {
        const eventIds = [...insertedEventIds];
        const actor = env.AUTO_ANALYZE_ACTOR;

        setImmediate(async () => {
          try {
            await incidentOrchestratorService.analyzeByEventIds({
              event_ids: eventIds,
              requested_by: actor
            });

            await query(
              `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                actor,
                "auto_analyze_triggered",
                "events_raw",
                String(eventIds[0]),
                JSON.stringify({
                  triggerType: "auto",
                  triggeredAt,
                  eventCount: eventIds.length,
                  eventIds: eventIds.slice(0, 50)
                })
              ]
            );
          } catch (error) {
            logger.error("auto analyze trigger failed", {
              event_ids: eventIds.slice(0, 20),
              error: error instanceof Error ? error.message : String(error)
            });

            try {
              await query(
                `INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  actor,
                  "auto_analyze_failed",
                  "events_raw",
                  String(eventIds[0]),
                  JSON.stringify({
                    triggerType: "auto",
                    triggeredAt,
                    eventCount: eventIds.length,
                    eventIds: eventIds.slice(0, 50),
                    error: error instanceof Error ? error.message : String(error)
                  })
                ]
              );
            } catch (auditError) {
              logger.error("auto analyze failure audit write failed", {
                error: auditError instanceof Error ? auditError.message : String(auditError)
              });
            }
          }
        });
      }
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);
