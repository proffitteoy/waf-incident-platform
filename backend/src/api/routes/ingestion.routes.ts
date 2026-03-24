import { Router } from "express";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { env } from "../../core/config/env";
import { pool, query } from "../../core/db/pool";
import { logger } from "../../core/logger";
import { parseCorazaAuditJsonLine } from "../../services/ingestion/coraza-audit.parser";
import { incidentOrchestratorService } from "../../services/incident/incident-orchestrator.service";
import { isIpWhitelisted } from "../../services/policy/ip-whitelist.service";
import { isIpGeoBlocked } from "../../services/policy/geo-block.service";

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

    // 对每个事件的 src_ip 做策略检查（白名单 + 地区封禁），结果批量缓存
    const policyCache = new Map<string, { whitelisted: boolean; geoBlocked: boolean; country: string | null }>();
    const uniqueIps = [...new Set(events.map((e) => e.src_ip).filter(Boolean))] as string[];

    for (const ip of uniqueIps) {
      try {
        const whitelisted = await isIpWhitelisted(ip);
        const { blocked: geoBlocked, country } = whitelisted ? { blocked: false, country: null } : await isIpGeoBlocked(ip);
        policyCache.set(ip, { whitelisted, geoBlocked, country });
      } catch (err) {
        logger.warn("policy check failed for ip, defaulting to allow", { ip, error: err instanceof Error ? err.message : String(err) });
        policyCache.set(ip, { whitelisted: false, geoBlocked: false, country: null });
      }
    }

    const client = await pool.connect();
    const insertedEventIds: number[] = [];
    const geoBlockedEventIds: number[] = [];

    try {
      await client.query("BEGIN");

      let whitelistedCount = 0;
      let geoBlockedCount = 0;

      for (const event of events) {
        const srcIp = event.src_ip ?? null;
        const policy = srcIp ? policyCache.get(srcIp) : null;

        // IP 白名单：跳过该事件，不写入 events_raw
        if (policy?.whitelisted) {
          whitelistedCount += 1;
          continue;
        }

        // 地区封禁：写入 events_raw，但在 tags 中追加封禁标记
        const tags = { ...(event.tags ?? {}) };
        if (policy?.geoBlocked && policy.country) {
          tags["geo_blocked"] = true;
          tags["geo_country"] = policy.country;
          geoBlockedCount += 1;
        }

        const insertResult = await client.query<{ id: number }>(
          `INSERT INTO events_raw (
             ts, asset_id, src_ip, method, uri, status,
             waf_engine, rule_id, rule_msg, rule_score, waf_action, tags
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            event.ts,
            input.asset_id ?? event.asset_id ?? null,
            srcIp,
            event.method ?? null,
            event.uri ?? null,
            event.status ?? null,
            event.waf_engine ?? "coraza",
            event.rule_id ?? null,
            event.rule_msg ?? null,
            event.rule_score ?? 0,
            event.waf_action ?? null,
            JSON.stringify(tags)
          ]
        );

        const eventId = insertResult.rows[0].id;
        insertedEventIds.push(eventId);
        if (policy?.geoBlocked) {
          geoBlockedEventIds.push(eventId);
        }
      }

      if (whitelistedCount > 0) {
        logger.info("ingestion: whitelisted events skipped", { whitelisted_count: whitelistedCount });
      }
      if (geoBlockedCount > 0) {
        logger.info("ingestion: geo-blocked events tagged", { geo_blocked_count: geoBlockedCount });
      }

      await client.query("COMMIT");
      res.status(201).json({
        inserted: insertedEventIds.length,
        parsed: events.length,
        dropped_lines: droppedLines,
        whitelisted_skipped: events.length - insertedEventIds.length - droppedLines,
        geo_blocked_tagged: geoBlockedEventIds.length
      });

      // 地区封禁事件：强制触发自动分析（无论 AUTO_ANALYZE_ON_INGEST 是否开启）
      if (geoBlockedEventIds.length > 0) {
        const geoIds = [...geoBlockedEventIds];
        const actor = env.AUTO_ANALYZE_ACTOR || "geo-block-policy";

        setImmediate(async () => {
          try {
            await incidentOrchestratorService.analyzeByEventIds({ event_ids: geoIds, requested_by: actor });
            logger.info("geo block auto-analysis completed", { event_ids: geoIds.slice(0, 20) });
          } catch (err) {
            logger.error("geo block auto-analysis failed", { error: err instanceof Error ? err.message : String(err) });
          }
        });
      }

      if (env.AUTO_ANALYZE_ON_INGEST && insertedEventIds.length > 0) {
        // 排除已被地区封禁分析处理过的事件，避免重复分析
        const remainingIds = insertedEventIds.filter((id) => !geoBlockedEventIds.includes(id));
        if (remainingIds.length === 0) return;
        const eventIds = remainingIds;
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
