import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { env } from "../../core/config/env";
import { pool, query } from "../../core/db/pool";
import { logger } from "../../core/logger";
import { parseCorazaAuditJsonLine } from "../../services/ingestion/coraza-audit.parser";
import { incidentOrchestratorService } from "../../services/incident/incident-orchestrator.service";

const ingestCorazaSchema = z.object({
  asset_id: z.string().uuid().optional(),
  lines: z.array(z.string().min(2)).min(1).max(5000)
});

export const ingestionRouter = Router();

ingestionRouter.post(
  "/ingestion/coraza/audit-lines",
  asyncHandler(async (req, res) => {
    const input = ingestCorazaSchema.parse(req.body);
    const triggeredAt = new Date().toISOString();

    const events = input.lines.flatMap((line) => parseCorazaAuditJsonLine(line));

    if (events.length === 0) {
      res.json({ inserted: 0, parsed: 0 });
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
      res.status(201).json({ inserted: events.length, parsed: events.length });

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
