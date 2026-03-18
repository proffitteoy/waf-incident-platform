import { Router, Request, Response } from 'express';
import { IncidentService } from '../../services/incident/incident.service';
import { logger } from '../../core/logger';

const router = Router();
const incidentService = new IncidentService();

/**
 * POST /api/incidents/analyze-events
 * 触发事件分析编排，生成 incident + alert + llm_report + llm_meta + source_events
 * 符合 api-spec.md 契约
 */
router.post('/analyze-events', async (req: Request, res: Response) => {
    try {
        const { eventIds, metadata, triggerType = 'manual', triggeredAt } = req.body;
        
        if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'eventIds 不能为空'
            });
        }

        logger.info('[IncidentRoutes] 收到分析编排请求', {
            eventCount: eventIds.length,
            triggerType,
            triggeredAt
        });

        // 调用服务层执行分析编排（返回符合 api-spec.md 的结构）
        const result = await incidentService.analyzeAndCreateIncidents(eventIds, {
            ...metadata,
            triggerType,
            triggeredAt
        });

        // 返回结构符合 api-spec.md：incident, alert, llm_report, llm_meta, source_events
        res.json({
            success: true,
            incident: result.incident,
            alert: result.alert,
            llm_report: result.llmReport,
            llm_meta: result.llmMeta,
            source_events: result.sourceEvents
        });
    } catch (error) {
        logger.error('[IncidentRoutes] 分析编排执行失败', {
            error: error instanceof Error ? error.message : String(error)
        });
        res.status(500).json({
            success: false,
            error: '分析编排执行失败'
        });
    }
});

export default router;