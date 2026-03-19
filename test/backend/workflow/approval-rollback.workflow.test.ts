import request from "supertest";
import { createTestApp } from "../backend-test-utils";

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

describe("approval -> action -> rollback workflow", () => {
  test("persists approvals/actions, verifies gateway effects and cleans redis state on rollback", async () => {
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
      expect(approveResponse.body.action.result).toBe("pending");
      expect(context.redisStore.size).toBe(1);

      const actionId = approveResponse.body.action.id as string;

      let applied = false;
      for (let i = 0; i < 20; i += 1) {
        const actionState = await context.query<{ result: string }>(
          "SELECT result FROM actions WHERE id = $1",
          [actionId]
        );

        if (actionState.rows[0]?.result === "success") {
          applied = true;
          break;
        }

        await wait(20);
      }

      expect(applied).toBe(true);

      const rollbackResponse = await request(context.app)
        .post(`/api/actions/${actionId}/rollback`)
        .send({
          actor: "analyst",
          reason: "false positive"
        });

      expect(rollbackResponse.status).toBe(200);
      expect(rollbackResponse.body.result).toBe("pending");
      expect(rollbackResponse.body.redis_cleared).toBe(true);
      expect(context.redisStore.size).toBe(0);

      const rollbackActionId = rollbackResponse.body.id as string;
      let rollbackApplied = false;
      for (let i = 0; i < 20; i += 1) {
        const actionState = await context.query<{ result: string }>(
          "SELECT result FROM actions WHERE id = $1",
          [rollbackActionId]
        );

        if (actionState.rows[0]?.result === "success") {
          rollbackApplied = true;
          break;
        }

        await wait(20);
      }

      expect(rollbackApplied).toBe(true);

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
      const receipts = await context.query<{ action_id: string; operation: string; status: string }>(
        "SELECT action_id::text, operation, status FROM action_receipts ORDER BY id ASC"
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
      expect(auditLogs.rows.map((entry: { action: string }) => entry.action)).toEqual(
        expect.arrayContaining([
          "approval_approved",
          "action_rollback",
          "action_verification_passed"
        ])
      );
      expect(receipts.rows).toEqual(
        expect.arrayContaining([
          { action_id: actionId, operation: "apply", status: "skipped" },
          { action_id: rollbackActionId, operation: "rollback", status: "skipped" }
        ])
      );
    } finally {
      await context.close();
    }
  }, 30000);
});
