import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../core/http/async-handler";
import { pool } from "../../core/db/pool";
import { parseCorazaAuditJsonLine } from "../../services/ingestion/coraza-audit.parser";

const ingestCorazaSchema = z.object({
  asset_id: z.string().uuid().optional(),
  lines: z.array(z.string().min(2)).min(1).max(5000)
});

export const ingestionRouter = Router();

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
      res.status(201).json({ inserted: events.length, parsed: events.length });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);
