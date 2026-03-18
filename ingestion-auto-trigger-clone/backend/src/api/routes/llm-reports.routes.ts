import { Router, Request, Response } from "express";
import { pool } from "../../core/database";
import { analyzeIncidentWithLlmApi } from "../../services/llm/incident-analyzer";

export const llmReportsRouter = Router();

llmReportsRouter.post("/analyze-events", async (req: Request, res: Response) => {
  try {
    const { eventIds, metadata, triggerType, triggeredAt } = req.body;
    
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      res.status(400).json({ error: "eventIds 必须是非空数组" });
      return;
    }

    const analysisResult = await analyzeIncidentWithLlmApi({
      eventIds,
      metadata,
      triggerType: triggerType || "manual",
      triggeredAt: triggeredAt || new Date().toISOString()
    });

    res.json(analysisResult);
  } catch (error) {
    console.error("[llm-reports] 分析失败:", error);
    res.status(500).json({ error: "分析失败" });
  }
});

llmReportsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM llm_reports WHERE incident_id = $1 ORDER BY created_at DESC",
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("[llm-reports] 查询失败:", error);
    res.status(500).json({ error: "查询失败" });
  }
});
