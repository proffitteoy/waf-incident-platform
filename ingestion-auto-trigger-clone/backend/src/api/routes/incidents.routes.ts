import { Router, Request, Response } from "express";
import { pool } from "../../core/database";

export const incidentsRouter = Router();

incidentsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM incidents ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("[incidents] 查询失败:", error);
    res.status(500).json({ error: "查询失败" });
  }
});

incidentsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM incidents WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "事件单不存在" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("[incidents] 查询失败:", error);
    res.status(500).json({ error: "查询失败" });
  }
});
