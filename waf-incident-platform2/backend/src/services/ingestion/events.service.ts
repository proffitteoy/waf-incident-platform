import { pool } from "../../core/db/pool";
import { SecurityEvent } from "../../core/types/security-event";

export const insertEvents = async (events: SecurityEvent[]): Promise<number> => {
  if (events.length === 0) {
    return 0;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let insertedCount = 0;

    for (const event of events) {
      await client.query(
        `INSERT INTO events_raw (
           ts, asset_id, src_ip, method, uri, status,
           waf_engine, rule_id, rule_msg, rule_score, waf_action, tags
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          event.ts,
          event.asset_id ?? null,
          event.src_ip ?? null,
          event.method ?? null,
          event.uri ?? null,
          event.status ?? null,
          event.waf_engine ?? null,
          event.rule_id ?? null,
          event.rule_msg ?? null,
          event.rule_score ?? 0,
          event.waf_action ?? null,
          JSON.stringify(event.tags ?? {})
        ]
      );
      insertedCount++;
    }

    await client.query("COMMIT");
    return insertedCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};