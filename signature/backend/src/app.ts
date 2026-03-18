import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { apiRouter } from "./api/router";
import { logger } from "./core/logger";
import { testConnection } from "./core/db/pool";

export const app = express();

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("combined"));

// 挂载 API 路由
app.use("/api", apiRouter);

// 根路径健康检查
app.get("/health", async (_req, res) => {
  const postgres = await testConnection();
  const ok = postgres;
  
  res.status(ok ? 200 : 503).json({
    ok,
    service: "signature-forensics-backend",
    postgres: postgres ? "up" : "down"
  });
});

// 404 处理
app.use((_req, res) => {
  res.status(404).json({ code: 404, msg: "Not Found" });
});

// 全局错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ code: 500, msg: "Internal Server Error" });
});