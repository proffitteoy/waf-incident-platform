import { Router, Request, Response } from "express";
import { pool } from "../../core/database";
import { redis } from "../../core/cache/redis";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  const status: { postgres: string; redis: string } = {
    postgres: "unknown",
    redis: "unknown"
  };

  try {
    await pool.query("SELECT 1");
    status.postgres = "ok";
  } catch {
    status.postgres = "error";
  }

  try {
    await redis.ping();
    status.redis = "ok";
  } catch {
    status.redis = "error";
  }

  res.json(status);
});