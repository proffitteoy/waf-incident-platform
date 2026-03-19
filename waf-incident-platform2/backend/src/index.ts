import express from 'express';
import { apiRouter } from './api/router';
import { runStartupChecks } from './core/bootstrap';
import { redisClient } from './core/cache/redis';

const app = express();
const PORT = process.env.PORT || 3000;

// 应用路由
app.use(apiRouter);

// 启动前预检
runStartupChecks()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[fatal] startup check failed, shutting down:', err);
    // 显式退出进程，符合文档“失败则服务不启动”的要求
    process.exit(1);
  });

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('[server] shutting down...');
  await redisClient.quit();
  process.exit(0);
});