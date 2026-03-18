import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ingestionRouter } from "./api/routes/ingestion.routes";
import { healthRouter } from "./api/routes/health.routes";
import { incidentsRouter } from "./api/routes/incidents.routes";
import { actionsRouter } from "./api/routes/actions.routes";
import { approvalsRouter } from "./api/routes/approvals.routes";
import { llmReportsRouter } from "./api/routes/llm-reports.routes";
import { mcpRouter } from "./api/routes/mcp.routes";
import { redis } from "./core/cache/redis";
import { pool } from "./core/database";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 健康检查（无前缀）
app.use("/health", healthRouter);

// API 路由（/api 前缀）
app.use("/api/ingestion", ingestionRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api", actionsRouter);
app.use("/api/approvals", approvalsRouter);
app.use("/api/incidents", llmReportsRouter);
app.use("/api/mcp", mcpRouter);

const startServer = async () => {
  try {
    // 检查 Redis 连接
    await redis.ping();
    console.log("[startup] Redis 连接成功");

    // 检查 PostgreSQL 连接
    await pool.query("SELECT 1");
    console.log("[startup] PostgreSQL 连接成功");

    app.listen(PORT, () => {
      console.log(`[startup] 服务启动于端口 ${PORT}`);
    });
  } catch (error) {
    console.error("[startup] 启动失败:", error);
    process.exit(1);
  }
};

startServer();