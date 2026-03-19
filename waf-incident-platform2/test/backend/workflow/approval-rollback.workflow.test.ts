// 修改点 1: 显式导入 supertest 的默认导出
// 原理：tsconfig.json 中 types 包含 "supertest" 后，编译器可解析 node_modules/@types/supertest/index.d.ts
// 从而识别 default 导入的 request 函数及其返回类型的链式调用结构。
import request from "supertest";

// 修改点 2: 显式导入 Jest 的核心全局函数
// 原理：tsconfig.json 中 types 包含 "jest" 后，编译器可解析 node_modules/@types/jest/index.d.ts
// 即使不依赖全局变量，也能正确识别从 "@jest/globals" 包中解构出的 describe, test, expect 等符号的类型。
import { describe, test, expect } from "@jest/globals";

// 修改点 3: 导入本地测试辅助工具及其类型定义
// 原因：引入 createTestApp 工厂函数和 TestAppContext 接口，用于后续变量类型声明。
import { createTestApp, TestAppContext } from "../backend-test-utils";

// 修改点 4: 定义简单的接口来描述测试中涉及的响应数据结构（可选但推荐，这里用 any 简化以匹配动态结构）
interface ApprovalResponse {
  id: string;
  body: {
    id: string;
    action: {
      id: string;
    };
  };
  status: number;
}

interface IncidentResponse {
  id: string;
}

describe("approval -> action -> rollback workflow", () => {
  test("persists approvals/actions and cleans redis state on rollback", async () => {
    // 修改点 5: 为 context 变量添加显式类型声明
    // 原因：消除 "Variable 'context' implicitly has type 'any'" 报错。
    const context: TestAppContext = await createTestApp({ surface: "workflow" });

    try {
      // 修改点 6: 为 incident 变量添加显式类型声明
      // 原因：seedIncident 返回 Promise<{id: string}>，显式声明避免隐式 any。
      const incident: IncidentResponse = await context.seedIncident();

      // 修改点 7: 为 approvalResponse 添加类型声明
      // 原因：request 返回的对象包含 status 和 body，显式声明以通过严格检查。
      const approvalResponse: { status: number; body: { id: string } } = await request(context.app)
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

      // 修改点 8: 为 approveResponse 添加类型声明
      // 原因：明确响应体结构，特别是嵌套的 action.id 字段。
      const approveResponse: { 
        status: number; 
        body: { 
          id: string; 
          action: { id: string }; 
        } 
      } = await request(context.app)
        .post(`/api/approvals/${approvalResponse.body.id}/approve`)
        .send({
          reviewer: "approver",
          comment: "approved"
        });

      expect(approveResponse.status).toBe(200);
      expect(context.redisStore.size).toBe(1);

      // 修改点 9: 显式声明 actionId 的类型
      // 原因：从 any 类型的 body 中取值时，显式标注 string 避免下游类型推断错误。
      const actionId: string = approveResponse.body.action.id as string;

      // 修改点 10: 为 rollbackResponse 添加类型声明
      // 原因：确保访问 redis_cleared 等字段时类型安全。
      const rollbackResponse: { 
        status: number; 
        body: { 
          redis_cleared: boolean; 
        } 
      } = await request(context.app)
        .post(`/api/actions/${actionId}/rollback`)
        .send({
          actor: "analyst",
          reason: "false positive"
        });

      expect(rollbackResponse.status).toBe(200);
      expect(rollbackResponse.body.redis_cleared).toBe(true);
      expect(context.redisStore.size).toBe(0);

      // 修改点 11: 为数据库查询结果泛型指定具体形状
      // 原因：让 query 函数知道返回的行结构，避免隐式 any。
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

      // 修改点 12: 为 map 回调函数的参数 entry 添加显式类型声明
      // 原因：解决 "Parameter 'entry' implicitly has an 'any' type" 报错。
      expect(actions.rows.map((entry: { action_type: string }) => entry.action_type)).toEqual([
        "block",
        "rollback"
      ]);

      // 修改点 13: 为 every 回调函数的参数 entry 添加显式类型声明
      // 原因：同上，确保类型安全。
      expect(actions.rows.every((entry: { result: string }) => entry.result === "success")).toBe(true);

      // 修改点 14: 为 map 回调函数的参数 entry 添加显式类型声明
      // 原因：同上。
      expect(auditLogs.rows.map((entry: { action: string }) => entry.action)).toEqual([
        "approval_approved",
        "action_rollback"
      ]);
    } finally {
      await context.close();
    }
  });
});