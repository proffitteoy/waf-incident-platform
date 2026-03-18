import { Router, Request, Response } from "express";
import { pool } from "../../core/database";

export const mcpRouter = Router();

mcpRouter.get("/tools", async (_req: Request, res: Response) => {
  const tools = [
    { name: "query_incidents", description: "查询事件单列表" },
    { name: "get_incident", description: "获取事件单详情" },
    { name: "query_events", description: "查询原始事件" },
    { name: "analyze_incident", description: "分析事件单" },
    { name: "apply_rate_limit", description: "应用限流" },
    { name: "block_ip_temp", description: "临时封禁 IP" },
    { name: "rollback_action", description: "回滚动作" }
  ];
  res.json({ tools });
});

mcpRouter.post("/invoke", async (req: Request, res: Response) => {
  try {
    const { tool, params } = req.body;
    // 工具调用逻辑
    res.json({ success: true, tool, result: {} });
  } catch (error) {
    console.error("[mcp] 调用失败:", error);
    res.status(500).json({ error: "调用失败" });
  }
});