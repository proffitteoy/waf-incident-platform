import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { query } from "./core/db/pool";
import { getRedisHealth } from "./core/cache/redis";
import { asyncHandler } from "./core/http/async-handler";
import { errorHandler, notFoundHandler } from "./core/http/error-handler";
import { apiRouter } from "./api/router";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("combined"));

app.get(
  "/health",
  asyncHandler(async (_req, res) => {
    let postgres = "up";

    try {
      await query("SELECT 1");
    } catch {
      postgres = "down";
    }

    const redis = getRedisHealth();
    const ok = postgres === "up" && redis.connected;

    res.status(ok ? 200 : 503).json({
      ok,
      service: "waf-incident-backend",
      postgres,
      redis
    });
  })
);

app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
