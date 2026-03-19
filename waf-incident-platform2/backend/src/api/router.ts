import { Router } from 'express';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { ingestionRouter } from './routes/ingestion.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { eventsRouter } from './routes/events.routes';
import { alertsRouter } from './routes/alerts.routes';
import { incidentsRouter } from './routes/incidents.routes';
import { actionsRouter } from './routes/actions.routes';
import { approvalsRouter } from './routes/approvals.routes';
import { forensicsRouter } from './routes/forensics.routes';
import { policiesRouter } from './routes/policies.routes';
import { assetsRouter } from './routes/assets.routes';
import { mcpRouter } from './routes/mcp.routes';

const router = Router();

// 健康检查 (无前缀)
router.use(healthRouter);

// API 前缀
router.use('/api', authRouter);
router.use('/api', ingestionRouter);
router.use('/api', dashboardRouter);
router.use('/api', eventsRouter);
router.use('/api', alertsRouter);
router.use('/api', incidentsRouter);
router.use('/api', actionsRouter);
router.use('/api', approvalsRouter);
router.use('/api', forensicsRouter);
router.use('/api', policiesRouter);
router.use('/api', assetsRouter);
// 新增 MCP 网关路由
router.use('/api', mcpRouter);

export { router as apiRouter };