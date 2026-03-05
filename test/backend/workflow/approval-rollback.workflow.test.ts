import request from "supertest";
import { createTestApp } from "../backend-test-utils";

describe("approval -> action -> rollback workflow", () => {
  test("persists approvals/actions and cleans redis state on rollback", async () => {
    const context = await createTestApp({ surface: "workflow" });

    try {
      const incident = await context.seedIncident();

      const approvalResponse = await request(context.app)
        .post(`/api/incidents/${incident.id}/actions/request-approval`)
        .send({
          action_plan: {
            action_type: "block",
            scope: "ip",
            target: "203.0.113.10",
            ttl_seconds: 1800
          },
          risk_level: "high",
          requested_by: "analyst",
          justification: "confirmed malicious requests"
        });

      expect(approvalResponse.status).toBe(201);

      const approveResponse = await request(context.app)
        .post(`/api/approvals/${approvalResponse.body.id}/approve`)
        .send({
          reviewer: "approver",
          comment: "approved"
        });

      expect(approveResponse.status).toBe(200);
      expect(context.redisStore.size).toBe(1);

      const actionId = approveResponse.body.action.id as string;
      const rollbackResponse = await request(context.app)
        .post(`/api/actions/${actionId}/rollback`)
        .send({
          actor: "analyst",
          reason: "false positive"
        });

      expect(rollbackResponse.status).toBe(200);
      expect(rollbackResponse.body.redis_cleared).toBe(true);
      expect(context.redisStore.size).toBe(0);

      const approvals = await context.query<{ status: string; reviewed_by: string }>(
        "SELECT status, reviewed_by FROM approvals WHERE id = $1",
        [approvalResponse.body.id]
      );
      const actions = await context.query<{ action_type: string; result: string }>(
        "SELECT action_type, result FROM actions WHERE incident_id = $1 ORDER BY created_at ASC",
        [incident.id]
      );
      const auditLogs = await context.query<{ action: string }>(
        "SELECT action FROM audit_logs ORDER BY id ASC"
      );

      expect(approvals.rows[0]).toEqual({
        status: "approved",
        reviewed_by: "approver"
      });
      expect(actions.rows.map((entry: { action_type: string }) => entry.action_type)).toEqual([
        "block",
        "rollback"
      ]);
      expect(actions.rows.every((entry: { result: string }) => entry.result === "success")).toBe(true);
      expect(auditLogs.rows.map((entry: { action: string }) => entry.action)).toEqual([
        "approval_approved",
        "action_rollback"
      ]);
    } finally {
      await context.close();
    }
  });
});
