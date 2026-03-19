import { app } from "./app";
import { env } from "./core/config/env";
import { closeRedis, connectRedis } from "./core/cache/redis";
import { pool } from "./core/db/pool";
import { logger } from "./core/logger";
import { startActionWatchdog, stopActionWatchdog } from "./services/policy/action-watchdog";

const bootstrap = async () => {
  await connectRedis();
  startActionWatchdog();

  const server = app.listen(env.BACKEND_PORT, () => {
    logger.info(`backend listening on :${env.BACKEND_PORT}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info(`received ${signal}, shutting down`);

    server.close(async () => {
      stopActionWatchdog();
      await Promise.allSettled([closeRedis(), pool.end()]);
      logger.info("shutdown complete");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("forced shutdown after timeout");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

void bootstrap().catch((error) => {
  logger.error("backend bootstrap failed", error instanceof Error ? error.message : error);
  process.exit(1);
});
