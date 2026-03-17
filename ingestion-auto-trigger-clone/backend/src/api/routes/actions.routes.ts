import { Router, Request, Response } from "express";
import { pool } from "../../core/database";
import { buildRedisKey, delRedisKey } from "../../core/cache/redis";

export const actionsRouter = Router();

actionsRouter.post("/:id/rollback", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");
      
      // 写入回滚动作记录
      await client.query(
        `INSERT INTO actions (incident_id, action_type, target, scope, status, executed_at)
         VALUES ($1, 'rollback', NULL, NULL, 'completed', NOW())`,
        [id]
      );
      
      // 清理 Redis 动作状态键
      const keys = await client.query("SELECT scope, action_type, target FROM actions WHERE id = $1", [id]);
      if (keys.rows.length > 0) {
        const { scope, action_type, target } = keys.rows[0];
        const redisKey = buildRedisKey("active_action", scope, action_type, target);
        await delRedisKey(redisKey);
      }
      
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[actions] 回滚失败:", error);
    res.status(500).json({ error: "回滚失败" });
  }
});
