import { Router, Request, Response } from "express";
import { pool } from "../../core/database";

export const approvalsRouter = Router();

approvalsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    let query = "SELECT * FROM approvals";
    const params: unknown[] = [];
    
    if (status) {
      query += " WHERE status = $1";
      params.push(status);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("[approvals] 查询失败:", error);
    res.status(500).json({ error: "查询失败" });
  }
});

approvalsRouter.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE approvals SET status = 'approved', approved_at = NOW() WHERE id = $1",
      [id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[approvals] 批准失败:", error);
    res.status(500).json({ error: "批准失败" });
  }
});

approvalsRouter.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE approvals SET status = 'rejected', rejected_at = NOW() WHERE id = $1",
      [id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[approvals] 拒绝失败:", error);
    res.status(500).json({ error: "拒绝失败" });
  }
});