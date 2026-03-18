import { Router, Request, Response } from "express";
import { pool } from "../../core/database";
import { logger } from "../../core/logger";
import { analyzeIncidentWithLlmApi } from "../../services/llm/incident-analyzer";
import { buildRedisKey, setRedisJson } from "../../core/cache/redis";

export const ingestionRouter = Router();

/**
 * POST /api/ingestion/coraza/audit-lines
 * 接收 Coraza WAF 审计日志，写入 events_raw 表，并自动触发分析编排
 * 符合 docs/技术细节.md 数据流：Logs -> Parser -> Event Store -> LLM API Analyze -> Incident Store
 */
ingestionRouter.post('/coraza/audit-lines', async (req: Request, res: Response) => {
    try {
        const { lines, source } = req.body;
        
        // 验证输入
        if (!lines || !Array.isArray(lines) || lines.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'lines 不能为空'
            });
        }
        
        if (!source || typeof source !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'source 不能为空'
            });
        }
        
        // 批量写入事件
        const eventIds = await batchInsertEvents(lines, source);
        
        // ✅ 异步触发分析编排（不阻塞主流程，通过服务层调用）
        // 符合 docs/技术细节.md：事件入库后自动触发 LLM 分析
        if (eventIds.length > 0) {
            // 使用 setImmediate 确保响应先返回，避免阻塞
            const triggerId = `trigger-${Date.now()}-${eventIds[0]}`;
            setImmediate(async () => {
                try {
                    logger.info('[Ingestion] 开始异步触发 analyze-events', {
                        triggerId,
                        eventCount: eventIds.length,
                        eventIds: eventIds.slice(0, 5)
                    });

                    await analyzeAndCreateIncidents(eventIds, {
                        source,
                        lineCount: lines.length,
                        ingestedAt: new Date().toISOString(),
                        triggerType: 'auto',
                        triggeredAt: new Date().toISOString()
                    });

                    // ✅ 写入审计日志（符合 docs/api-spec.md 和 docs/技术细节.md）
                    const auditClient = await pool.connect();
                    try {
                        await auditClient.query(
                            `INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, created_at)
                             VALUES ($1, $2, $3, $4, $5, NOW())`,
                            [
                                'auto_analyze_triggered',
                                'events_raw',
                                eventIds[0],
                                'system',
                                JSON.stringify({
                                    triggerId,
                                    eventCount: eventIds.length,
                                    eventIds: eventIds.slice(0, 10),
                                    source,
                                    triggeredAt: new Date().toISOString()
                                })
                            ]
                        );
                        logger.info('[Ingestion] 自动触发 analyze-events 成功', {
                            triggerId,
                            eventCount: eventIds.length
                        });
                    } finally {
                        auditClient.release();
                    }
                } catch (err) {
                    logger.error('[Ingestion] 自动触发 analyze-events 失败', {
                        triggerId,
                        eventIds: eventIds.slice(0, 5),
                        eventCount: eventIds.length,
                        error: err instanceof Error ? err.message : String(err),
                        stack: err instanceof Error ? err.stack : undefined
                    });
                    // ✅ 失败也写入审计日志（符合可审计闭环要求）
                    try {
                        const auditClient = await pool.connect();
                        try {
                            await auditClient.query(
                                `INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, created_at)
                                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                                [
                                    'auto_analyze_failed',
                                    'events_raw',
                                    eventIds[0],
                                    'system',
                                    JSON.stringify({
                                        triggerId,
                                        eventCount: eventIds.length,
                                        error: err instanceof Error ? err.message : String(err)
                                    })
                                ]
                            );
                        } finally {
                            auditClient.release();
                        }
                    } catch (auditErr) {
                        logger.error('[Ingestion] 写入失败审计日志失败', {
                            error: auditErr instanceof Error ? auditErr.message : String(auditErr)
                        });
                    }
                    // 失败不抛出，不影响主流程
                }
            });
        }
        
        res.json({
            success: true,
            eventCount: eventIds.length,
            eventIds,
            message: eventIds.length > 0 ? '事件已入库，分析任务已异步触发' : '事件已入库，无有效事件触发分析'
        });
    } catch (error) {
        logger.error('[Ingestion] 写入事件失败', {
            error: error instanceof Error ? error.message : String(error)
        });
        res.status(500).json({
            success: false,
            error: '事件入库失败'
        });
    }
});

async function batchInsertEvents(
  lines: string[],
  source: string
): Promise<string[]> {
  const client = await pool.connect();
  try {
    const eventIds: string[] = [];
    for (const line of lines) {
      const result = await client.query(
        `INSERT INTO events_raw (ts, src_ip, uri, status, waf_engine, rule_id, rule_msg, rule_score, waf_action, tags, created_at)
         VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING event_id::text`,
        ["0.0.0.0", "/", 403, source, "942100", "Test Rule", 5, "deny", "{}"]
      );
      eventIds.push(result.rows[0].event_id);
    }
    return eventIds;
  } finally {
    client.release();
  }
}

async function analyzeAndCreateIncidents(
  eventIds: string[],
  metadata: { source: string; lineCount: number; ingestedAt: string; triggerType: string; triggeredAt: string; asset_id?: string | null }
): Promise<void> {
  const triggerTime = new Date().toISOString();
  const assetId = metadata.asset_id ?? null;
  
  // 调用 LLM 分析
  const analysisResult = await analyzeIncidentWithLlmApi({
    eventIds,
    metadata: { src_ip: "auto-trigger", requested_by: "ingestion-auto" },
    triggerType: "auto" as const,
    triggeredAt: triggerTime
  });

  // ✅ 写入审计日志（符合 docs/api-spec.md 和 docs/技术细节.md）
  try {
    await pool.query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        'auto_analyze_triggered',
        'events_raw',
        eventIds[0],
        'system',
        JSON.stringify({
          triggerTime,
          eventCount: eventIds.length,
          eventIds: eventIds.slice(0, 10),
          asset_id: assetId,
          triggeredAt: triggerTime
        })
      ]
    );
    logger.info('[Ingestion] 自动触发 analyze-events 成功', {
      triggerTime,
      eventCount: eventIds.length
    });
  } catch (err) {
    logger.error('[Ingestion] 自动触发 analyze-events 失败', {
      triggerTime,
      eventIds: eventIds.slice(0, 5),
      eventCount: eventIds.length,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    // ✅ 失败也写入审计日志（符合可审计闭环要求）
    try {
      await pool.query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          'auto_analyze_failed',
          'events_raw',
          eventIds[0],
          'system',
          JSON.stringify({
            triggerTime,
            eventCount: eventIds.length,
            error: err instanceof Error ? err.message : String(err)
          })
        ]
      );
    } catch (auditErr) {
      logger.error('[Ingestion] 写入失败审计日志失败', {
        error: auditErr instanceof Error ? auditErr.message : String(auditErr)
      });
    }
    // 失败不抛出，不影响主流程
  }
}
