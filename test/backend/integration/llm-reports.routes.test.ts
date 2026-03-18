import request from "supertest";
import { createTestApp } from "../backend-test-utils";

jest.setTimeout(20000);

describe("POST /api/incidents/analyze-events", () => {
  test("creates incident, alert, llm_report and audit logs from events_raw", async () => {
    const context = await createTestApp({ surface: "llm-reports" });

    try {
      await context.seedEventRaw();
      await context.seedEventRaw({
        ts: "2026-03-04T00:01:00.000Z",
        uri: "/admin",
        rule_score: 6
      });

      const response = await request(context.app)
        .post("/api/incidents/analyze-events")
        .send({ src_ip: "203.0.113.10", requested_by: "tester", limit: 10 });

      expect(response.status).toBe(201);
      expect(response.body.source_events).toBe(2);
      expect(response.body.incident.title).toBe("SQLi from 203.0.113.10");
      expect(response.body.llm_meta.prompt_version).toBe("v1");

      const incidents = await context.query<{ id: string }>("SELECT id::text FROM incidents");
      const alerts = await context.query<{ id: string }>("SELECT id::text FROM alerts");
      const reports = await context.query<{ task: string; prompt_version: string; prompt_digest: string }>(
        "SELECT task, prompt_version, prompt_digest FROM llm_reports"
      );
      const auditLogs = await context.query<{ action: string }>("SELECT action FROM audit_logs ORDER BY id ASC");

      expect(incidents.rowCount).toBe(1);
      expect(alerts.rowCount).toBe(1);
      expect(reports.rowCount).toBe(1);
      expect(reports.rows[0]).toEqual(
        expect.objectContaining({
          task: "waf_incident_analysis_mvp",
          prompt_version: "v1",
          prompt_digest: "prompt-digest"
        })
      );
      expect(auditLogs.rows.map((entry: { action: string }) => entry.action)).toEqual([
        "llm_analysis_completed",
        "llm_incident_generated"
      ]);
    } finally {
      await context.close();
    }
  });

  test("accepts event_ids and prioritizes id-based lookup", async () => {
    const context = await createTestApp({ surface: "llm-reports" });

    try {
      const firstId = await context.seedEventRaw({
        src_ip: "198.51.100.10",
        uri: "/selected"
      });
      await context.seedEventRaw({
        src_ip: "198.51.100.20",
        uri: "/ignored"
      });

      const response = await request(context.app)
        .post("/api/incidents/analyze-events")
        .send({
          event_ids: [firstId],
          src_ip: "203.0.113.255",
          requested_by: "event-id-tester",
          limit: 10
        });

      expect(response.status).toBe(201);
      expect(response.body.source_events).toBe(1);

      const incidentRows = await context.query<{ src_ip: string | null }>(
        "SELECT src_ip::text FROM incidents ORDER BY created_at DESC LIMIT 1"
      );

      expect(incidentRows.rows[0].src_ip).toBe("198.51.100.10");
    } finally {
      await context.close();
    }
  });
});

describe("POST /api/incidents/:id/llm-reports", () => {
  test("accepts manual report metadata defined in the docs contract", async () => {
    const context = await createTestApp({ surface: "llm-reports" });

    try {
      const incident = await context.seedIncident();

      const response = await request(context.app)
        .post(`/api/incidents/${incident.id}/llm-reports`)
        .send({
          model: "manual-review",
          task: "manual_override",
          prompt_version: "v-manual",
          prompt_digest: "digest-manual",
          input_digest: "input-manual",
          attack_chain: [{ stage: "review", detail: "analyst input" }],
          key_iocs: [{ type: "uri", value: "/login" }],
          risk_assessment: { summary: "manual confirmation" },
          recommended_actions_low: ["watch"],
          recommended_actions_high: ["block"],
          confidence: 80
        });

      expect(response.status).toBe(201);

      const reports = await context.query<{ model: string; task: string; prompt_version: string }>(
        "SELECT model, task, prompt_version FROM llm_reports WHERE incident_id = $1",
        [incident.id]
      );

      expect(reports.rowCount).toBe(1);
      expect(reports.rows[0]).toEqual({
        model: "manual-review",
        task: "manual_override",
        prompt_version: "v-manual"
      });
    } finally {
      await context.close();
    }
  });
});
