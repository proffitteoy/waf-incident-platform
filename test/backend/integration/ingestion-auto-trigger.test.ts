import request from "supertest";
import { createTestApp } from "../backend-test-utils";

jest.setTimeout(20000);

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

describe("POST /api/ingestion/coraza/audit-lines", () => {
  test("returns 201 immediately and writes auto trigger audit asynchronously", async () => {
    const context = await createTestApp({
      surface: "ingestion",
      envOverrides: {
        AUTO_ANALYZE_ON_INGEST: "true",
        AUTO_ANALYZE_ACTOR: "ingestion-auto-test"
      }
    });

    try {
      const line = JSON.stringify({
        transaction: {
          time_stamp: "2026-03-04T00:00:00.000Z",
          client_ip: "203.0.113.10",
          request: { method: "GET", uri: "/login" },
          response: { http_code: 403 },
          producer: { engine: "coraza" },
          messages: [
            {
              message: "SQL Injection Attack Detected",
              details: {
                ruleId: "942100",
                message: "SQL Injection Attack Detected",
                data: "anomaly score 8",
                tags: ["attack-sqli"]
              }
            }
          ],
          interruption: { action: "deny" }
        }
      });

      const response = await request(context.app)
        .post("/api/ingestion/coraza/audit-lines")
        .send({ lines: [line] });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ inserted: 1, parsed: 1 });

      let triggered = false;
      for (let i = 0; i < 30; i += 1) {
        const auditRows = await context.query<{ action: string }>(
          "SELECT action FROM audit_logs WHERE action = 'auto_analyze_triggered'"
        );

        if ((auditRows.rowCount ?? 0) > 0) {
          triggered = true;
          break;
        }

        await wait(20);
      }

      expect(triggered).toBe(true);

      const incidents = await context.query<{ id: string }>("SELECT id::text FROM incidents");
      expect(incidents.rowCount).toBe(1);

      const autoAudit = await context.query<{ actor: string; action: string }>(
        "SELECT actor, action FROM audit_logs WHERE action LIKE 'auto_analyze_%' ORDER BY id DESC LIMIT 1"
      );

      expect(autoAudit.rows[0]).toEqual({ actor: "ingestion-auto-test", action: "auto_analyze_triggered" });
    } finally {
      await context.close();
    }
  });
});
