import request from "supertest";
import { createTestApp } from "../backend-test-utils";

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
