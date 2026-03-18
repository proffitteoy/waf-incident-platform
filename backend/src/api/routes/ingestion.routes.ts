import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { pool } from "../../core/db/pool";
import { logger } from "../../core/logger";
import { parseCorazaAuditJsonLine } from "../../services/ingestion/coraza-audit.parser";
import { analyzeEventsFromDataset } from "../../services/orchestration/analyze-events";

const ingestCorazaSchema = z.object({
  asset_id: z.string().uuid().optional(),
  lines: z.array(z.string().min(2)).min(1).max(5000)
});

export const ingestionRouter = Router();

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown error";
};

ingestionRouter.post(
  "/ingestion/coraza/audit-lines",
  asyncHandler(async (req, res) => {
    const input = ingestCorazaSchema.parse(req.body);

    const events = input.lines.flatMap((line) => parseCorazaAuditJsonLine(line));

    if (events.length === 0) {
      res.json({ inserted: 0, parsed: 0 });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const event of events) {
        await client.query(
          `INSERT INTO events_raw (
             ts, asset_id, src_ip, method, uri, status,
             waf_engine, rule_id, rule_msg, rule_score, waf_action, tags
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
      }

      await client.query("COMMIT");

      let orchestration:
        | {
            triggered: true;
            incident_id: string;
            source_events: number;
          }
        | {
            triggered: false;
            error: string;
          };

      try {
        const orchestrationResult = await analyzeEventsFromDataset({
          requested_by: "ingestion:auto",
          asset_id: input.asset_id,
          events: events.map((event, index) => ({
            id: index + 1,
            ts: event.ts,
            asset_id: input.asset_id ?? event.asset_id ?? null,
            src_ip: event.src_ip ?? null,
            method: event.method ?? null,
            uri: event.uri ?? null,
            status: event.status ?? null,
            rule_id: event.rule_id ?? null,
            rule_msg: event.rule_msg ?? null,
            rule_score: event.rule_score ?? 0,
            waf_action: event.waf_action ?? null
          }))
        });

        orchestration = {
          triggered: true,
          incident_id: orchestrationResult.incident.id,
          source_events: orchestrationResult.source_events
        };
      } catch (orchestrationError) {
        const message = toErrorMessage(orchestrationError);
        logger.error("auto orchestration after ingestion failed", {
          error: message,
          parsed_events: events.length,
          asset_id: input.asset_id ?? null
        });

        orchestration = {
          triggered: false,
          error: message
        };
      }

      res.status(201).json({ inserted: events.length, parsed: events.length, orchestration });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);
