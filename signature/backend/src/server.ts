import { app } from "./app";
import { env } from "./core/config/env";
import { logger } from "./core/logger";
import { closePool } from "./core/db/pool";

const bootstrap = async () => {
  try {
    // 测试数据库连接
    const dbOk = await import("./core/db/pool").then(m => m.testConnection());
    if (!dbOk) {
      logger.error("PostgreSQL connection failed");
      process.exit(1);
    }
    
    logger.info("PostgreSQL connection OK");
    
    // 启动服务
    app.listen(env.BACKEND_PORT, () => {
      logger.info(`Server running on port ${env.BACKEND_PORT}`);
    });
    
    // 优雅退出
    process.on("SIGINT", async () => {
      logger.info("Shutting down...");
      await closePool();
      process.exit(0);
    });
    
    process.on("SIGTERM", async () => {
      logger.info("Shutting down...");
      await closePool();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Bootstrap failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
};

void bootstrap();