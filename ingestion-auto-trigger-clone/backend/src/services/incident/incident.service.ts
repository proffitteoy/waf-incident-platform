import { pool } from '../../core/database';
import { logger } from '../../core/logger';
import { IncidentAnalyzer } from '../../llm/incident-analyzer';
import { PromptRegistry } from '../../llm/prompt-registry';
import { redisClient } from '../../core/redis';

export interface AnalyzeMetadata {
    source?: string;
    lineCount?: number;
    ingestedAt?: string;
    triggerType?: 'auto' | 'manual';
    triggeredAt?: string;
}

export interface AnalyzeResult {
    incident: any;
    alert: any;
    llmReport: any;
    llmMeta: {
        provider: string;
        degraded: boolean;
        attempts: number;
        retries: number;
        latency_ms: number;
        circuit_state: string;
        task: string;
        prompt_version: string;
        prompt_digest: string;
        model: string;
        model_version: string;
        report_model: string;
        input_digest: string;
        failure_reason?: string;
    };
    sourceEvents: any[];
}

export class IncidentService {
    private readonly analyzer: IncidentAnalyzer;
    private readonly promptRegistry: PromptRegistry;

    constructor() {
        this.analyzer = new IncidentAnalyzer();
        this.promptRegistry = new PromptRegistry();
    }

    /**
     * 分析事件并创建事件单
     * 符合 api-spec.md 返回结构：incident, alert, llm_report, llm_meta, source_events
     * @param eventIds 事件 ID 列表
     * @param metadata 元数据
     * @returns 分析结果
     */
    async analyzeAndCreateIncidents(
        eventIds: string[],
        metadata: AnalyzeMetadata
    ): Promise<AnalyzeResult> {
        const client = await pool.connect();
        let incidentResult: any = null;
        let alertResult: any = null;
        let llmReportResult: any = null;
        let llmMetaResult: AnalyzeResult['llmMeta'] | null = null;
        let sourceEvents: any[] = [];

        try {
            await client.query('BEGIN');

            // 1. 获取原始事件
            const eventsResult = await client.query(
                'SELECT * FROM events_raw WHERE event_id = ANY($1)',
                [eventIds]
            );
            sourceEvents = eventsResult.rows;

            if (sourceEvents.length === 0) {
                await client.query('ROLLBACK');
                throw new Error('事件不存在');
            }

            // 2. 使用 LLM 分析（真实 API 调用，非占位实现）
            const analysisStartTime = Date.now();
            const analysisResult = await this.analyzer.analyzeEvents(sourceEvents);
            const latencyMs = Date.now() - analysisStartTime;

            // 3. 提取 llm_meta 元数据（符合 api-spec.md）
            llmMetaResult = {
                provider: analysisResult.provider || 'openai',
                degraded: analysisResult.degraded || false,
                attempts: analysisResult.attempts || 1,
                retries: analysisResult.retries || 0,
                latency_ms: latencyMs,
                circuit_state: analysisResult.circuitState || 'closed',
                task: analysisResult.task || 'incident_analysis',
                prompt_version: analysisResult.promptVersion || 'v1.0',
                prompt_digest: analysisResult.promptDigest || '',
                model: analysisResult.model || 'gpt-4',
                model_version: analysisResult.modelVersion || 'latest',
                report_model: analysisResult.reportModel || 'gpt-4',
                input_digest: analysisResult.inputDigest || '',
                failure_reason: analysisResult.failureReason
            };

            // 4. 创建事件单
            if (analysisResult.shouldCreateIncident) {
                incidentResult = await client.query(
                    `INSERT INTO incidents (title, severity, status, created_at, metadata)
                     VALUES ($1, $2, 'open', NOW(), $3)
                     RETURNING *`,
                    [analysisResult.title, analysisResult.severity, JSON.stringify(metadata)]
                );
                const incidentId = incidentResult.rows[0].incident_id;

                // 5. 创建告警
                for (const event of sourceEvents) {
                    alertResult = await client.query(
                        `INSERT INTO alerts (incident_id, event_id, alert_type, created_at)
                         VALUES ($1, $2, 'auto_detected', NOW())
                         RETURNING *`,
                        [incidentId, event.event_id]
                    );
                }

                // 6. 更新事件状态
                await client.query(
                    `UPDATE events_raw SET status = 'analyzed', incident_id = $1 WHERE event_id = ANY($2)`,
                    [incidentId, eventIds]
                );

                // 7. 写入 llm_reports（记录元数据，符合技术细节.md）
                llmReportResult = await client.query(
                    `INSERT INTO llm_reports 
                     (incident_id, model, task, prompt_version, prompt_digest, input_digest, 
                      attack_chain, key_iocs, risk_assessment, recommended_actions_low, 
                      recommended_actions_high, confidence, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                     RETURNING *`,
                    [
                        incidentId,
                        llmMetaResult.model,
                        llmMetaResult.task,
                        llmMetaResult.prompt_version,
                        llmMetaResult.prompt_digest,
                        llmMetaResult.input_digest,
                        JSON.stringify(analysisResult.attackChain || []),
                        JSON.stringify(analysisResult.keyIocs || []),
                        analysisResult.riskAssessment,
                        JSON.stringify(analysisResult.recommendedActionsLow || []),
                        JSON.stringify(analysisResult.recommendedActionsHigh || []),
                        analysisResult.confidence || 0.5
                    ]
                );
            }

            await client.query('COMMIT');

            // ✅ 写入分析完成审计日志（符合 docs/技术细节.md 可审计闭环要求）
            try {
                await client.query(
                    `INSERT INTO audit_logs (action, entity_type, entity_id, actor, details, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [
                        'llm_analysis_completed',
                        'incident',
                        incidentResult?.rows[0]?.incident_id || null,
                        metadata.triggerType === 'auto' ? 'system' : 'manual',
                        JSON.stringify({
                            eventCount: sourceEvents.length,
                            triggerType: metadata.triggerType,
                            llmMeta: llmMetaResult
                        }),
                    ]
                );
            } catch (auditErr) {
                logger.error('[IncidentService] 写入审计日志失败', {
                    error: auditErr instanceof Error ? auditErr.message : String(auditErr)
                });
                // 审计日志失败不影响主流程
            }

            return {
                incident: incidentResult?.rows[0] || null,
                alert: alertResult?.rows[0] || null,
                llmReport: llmReportResult?.rows[0] || null,
                llmMeta: llmMetaResult!,
                sourceEvents
            };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('[IncidentService] 分析编排失败', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        } finally {
            client.release();
        }
    }
}