import request from "supertest";
import { createTestApp } from "../backend-test-utils";

describe("POST /api/ingestion/coraza/audit-lines", () => {
  test("ingests events_raw and auto-triggers incident orchestration", async () => {
    const context = await createTestApp({ surface: "ingestion" });

    try {
      const line = JSON.stringify({
        transaction: {
          timestamp: "2026-03-04T00:00:00.000Z",
          client_ip: "203.0.113.10",
          request: {
            method: "GET",
            uri: "/login"
          },
          response: {
            http_code: 403
          },
          producer: {
            engine: "coraza"
          },
          interruption: {
            action: "deny"
          },
          messages: [
            {
              message: "SQL Injection Attack Detected",
              details: {
                ruleId: "942100",
                message: "SQL Injection Attack Detected",
                data: "inbound anomaly score 8",
                tags: ["attack-sqli"]
              }
            }
          ]
        }
      });

      const response = await request(context.app)
        .post("/api/ingestion/coraza/audit-lines")
        .send({
          lines: [line]
        });

      expect(response.status).toBe(201);
      expect(response.body.inserted).toBe(1);
      expect(response.body.parsed).toBe(1);
      expect(response.body.orchestration).toEqual(
        expect.objectContaining({
          triggered: true,
          source_events: 1
        })
      );

      const events = await context.query<{ id: number }>("SELECT id FROM events_raw");
      const incidents = await context.query<{ id: string }>("SELECT id::text FROM incidents");
      const alerts = await context.query<{ id: string }>("SELECT id::text FROM alerts");
      const reports = await context.query<{ id: string }>("SELECT id::text FROM llm_reports");

      expect(events.rowCount).toBe(1);
      expect(incidents.rowCount).toBe(1);
      expect(alerts.rowCount).toBe(1);
      expect(reports.rowCount).toBe(1);
    } finally {
      await context.close();
    }
  });
});
