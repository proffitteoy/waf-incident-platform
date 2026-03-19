import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../../core/db/pool';
import { redisClient } from '../../core/cache/redis';
import { asyncHandler } from '../../core/http/async-handler';
import { analyzeIncidentWithLlmApi } from '../../services/llm/incident-analyzer';
import { buildRedisKey, delRedisKey, setRedisJson } from '../../core/cache/redis';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const router = Router();

// MCP Tool 定义元数据
const TOOLS_META = [
  { name: 'query_incidents', description: '查询事件单列表', parameters: { status: 'string (optional)' } },
  { name: 'get_incident', description: '获取单个事件单详情', parameters: { incident_id: 'string' } },
  { name: 'query_events', description: '查询原始安全事件', parameters: { src_ip: 'string', limit: 'number (optional)' } },
  { name: 'get_policies', description: '获取当前策略配置', parameters: {} },
  { name: 'get_recent_stats', description: '获取近期统计概览', parameters: { range: 'string (e.g., 1h, 24h)' } },
  { name: 'analyze_incident', description: '调用 LLM 分析事件单', parameters: { incident_id: 'string', actor: 'string' } },
  { name: 'apply_rate_limit', description: '应用限流动作', parameters: { incident_id: 'string', target: 'string', scope: 'string', ttl: 'number', reason: 'string', actor: 'string' } },
  { name: 'block_ip_temp', description: '临时封禁 IP', parameters: { incident_id: 'string', target: 'string', scope: 'string', ttl: 'number', reason: 'string', actor: 'string' } },
  { name: 'challenge_ip', description: '发起挑战验证', parameters: { incident_id: 'string', target: 'string', scope: 'string', ttl: 'number', reason: 'string', actor: 'string' } },
  { name: 'rollback_action', description: '回滚已执行动作', parameters: { action_id: 'string' } },
  { name: 'create_approval_request', description: '创建高危动作审批请求', parameters: { incident_id: 'string', action_plan: 'object', risk_level: 'string', requested_by: 'string', justification: 'string' } },
  { name: 'capture_pcap', description: '触发流量抓包取证', parameters: { incident_id: 'string', time_window: 'number', filter_expr: 'string (optional)' } },
  { name: 'get_forensics', description: '获取取证任务列表', parameters: { incident_id: 'string' } },
  { name: 'get_pcap_meta', description: '获取 pcap 文件元数据', parameters: { fid: 'string' } }
];

/**
 * GET /api/mcp/tools
 * 返回 MCP 工具列表契约
 */
router.get('/mcp/tools', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    tools: TOOLS_META
  });
}));

/**
 * POST /api/mcp/invoke
 * 执行 MCP 工具调用
 */
router.post('/mcp/invoke', asyncHandler(async (req: Request, res: Response) => {
  const { tool, arguments: args } = req.body as { tool: string; arguments?: Record<string, any> };

  if (!tool) {
    res.status(400).json({ error: 'missing tool name' });
    return;
  }

  switch (tool) {
    case 'query_incidents': {
      const { status } = args || {};
      let query = 'SELECT id, title, severity, status, created_at FROM incidents';
      const params: any[] = [];
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC LIMIT 50';
      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
      break;
    }

    case 'get_incident': {
      const { incident_id } = args || {};
      if (!incident_id) {
        res.status(400).json({ error: 'missing incident_id' });
        return;
      }
      const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [incident_id]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'incident not found' });
        return;
      }
      res.json({ success: true, data: result.rows[0] });
      break;
    }

    case 'query_events': {
      const { src_ip, limit = 100 } = args || {};
      if (!src_ip) {
        res.status(400).json({ error: 'missing src_ip' });
        return;
      }
      const result = await pool.query(
        'SELECT * FROM events_raw WHERE src_ip = $1 ORDER BY ts DESC LIMIT $2',
        [src_ip, limit]
      );
      res.json({ success: true, data: result.rows });
      break;
    }

    case 'get_policies': {
      const result = await pool.query('SELECT * FROM policies');
      res.json({ success: true, data: result.rows });
      break;
    }

    case 'get_recent_stats': {
      // 简化实现，实际应根据 range 动态构建 SQL
      const result = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE severity = 'high') as high_count,
          COUNT(*) FILTER (WHERE severity = 'medium') as medium_count,
          COUNT(*) FILTER (WHERE status = 'open') as open_count
        FROM incidents 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      res.json({ success: true, data: result.rows[0] });
      break;
    }

    case 'analyze_incident': {
      const { incident_id, actor = 'mcp-agent' } = args || {};
      if (!incident_id) {
        res.status(400).json({ error: 'missing incident_id' });
        return;
      }

      // 修复：获取事件单关联的原始事件数据，供 LLM 分析使用
      // 1. 获取 incident 基本信息
      const incResult = await pool.query('SELECT * FROM incidents WHERE id = $1', [incident_id]);
      if (incResult.rowCount === 0) {
        res.status(404).json({ error: 'incident not found' });
        return;
      }
      const incident = incResult.rows[0];

      // 2. 获取关联的 source_events (假设 events_raw 中有 incident_id 关联，或通过 alert 关联)
      // 这里假设 events_raw 表在创建 incident 时已标记 incident_id，或者通过 alert 表关联
      // 根据 docs/技术细节.md 流程：events_raw -> incident，通常 events_raw 可能没有 incident_id
      // 需要通过 alert 表关联：events_raw.id = alert.event_id AND alert.incident_id = ?
      const eventsResult = await pool.query(`
        SELECT e.* 
        FROM events_raw e
        JOIN alerts a ON e.id = a.event_id
        WHERE a.incident_id = $1
        ORDER BY e.ts ASC
        LIMIT 50
      `, [incident_id]);

      // 3. 构造分析参数
      const analysis = await analyzeIncidentWithLlmApi({
        requested_by: actor,
        asset_id: incident.asset_id || null,
        src_ip: incident.src_ip || null,
        events: eventsResult.rows.map((row: any, index: number) => ({
          id: index + 1,
          ts: row.ts,
          asset_id: row.asset_id || null,
          src_ip: row.src_ip || null,
          method: row.method || null,
          uri: row.uri || null,
          status: row.status || null,
          rule_id: row.rule_id || null,
          rule_msg: row.rule_msg || null,
          rule_score: row.rule_score || null,
          waf_action: row.waf_action || null
        }))
      });

      res.json({ success: true, data: analysis });
      break;
    }

    case 'apply_rate_limit':
    case 'block_ip_temp':
    case 'challenge_ip': {
      const { incident_id, target, scope, ttl, reason, actor } = args || {};
      if (!incident_id || !target || !actor) {
        res.status(400).json({ error: 'missing required fields (incident_id, target, actor)' });
        return;
      }
      const actionType = tool === 'apply_rate_limit' ? 'rate_limit' : tool === 'block_ip_temp' ? 'block_ip' : 'challenge';
      
      // 写入 actions 表
      const actionId = crypto.randomUUID(); // 需引入 crypto
      await pool.query(
        `INSERT INTO actions (id, incident_id, type, target, scope, ttl_seconds, reason, requested_by, executed_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'executed')`,
        [actionId, incident_id, actionType, target, scope || 'global', ttl || 3600, reason, actor, actor]
      );

      // 写入 Redis 状态
      const redisKey = buildRedisKey('waf:mvp', 'active_action', `${scope || 'global'}:${actionType}:${Buffer.from(target).toString('base64url')}`);
      await redisClient.setEx(redisKey, ttl || 3600, JSON.stringify({ action_id: actionId, incident_id, executed_at: new Date().toISOString() }));

      res.json({ success: true, action_id: actionId, message: `${actionType} applied` });
      break;
    }

    case 'rollback_action': {
      const { action_id } = args || {};
      if (!action_id) {
        res.status(400).json({ error: 'missing action_id' });
        return;
      }
      // 查找原动作
      const original = await pool.query('SELECT * FROM actions WHERE id = $1', [action_id]);
      if (original.rowCount === 0) {
        res.status(404).json({ error: 'action not found' });
        return;
      }
      const origAction = original.rows[0];

      // 写入回滚动作
      const rollbackId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO actions (id, incident_id, type, target, scope, reason, requested_by, executed_by, status, parent_action_id)
         VALUES ($1, $2, 'rollback', $3, $4, 'Rollback by MCP', 'mcp-agent', 'mcp-agent', 'executed', $5)`,
        [rollbackId, origAction.incident_id, origAction.target, origAction.scope, action_id]
      );

      // 清理 Redis
      const redisKey = buildRedisKey('waf:mvp', 'active_action', `${origAction.scope}:${origAction.type}:${Buffer.from(origAction.target).toString('base64url')}`);
      await delRedisKey(redisKey);

      res.json({ success: true, rollback_id: rollbackId, message: 'action rolled back' });
      break;
    }

    case 'create_approval_request': {
      const { incident_id, action_plan, risk_level, requested_by, justification } = args || {};
      if (!incident_id || !action_plan || !requested_by) {
        res.status(400).json({ error: 'missing required fields' });
        return;
      }
      const approvalId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO approvals (id, incident_id, action_plan, risk_level, requested_by, justification, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [approvalId, incident_id, JSON.stringify(action_plan), risk_level || 'high', requested_by, justification]
      );
      res.json({ success: true, approval_id: approvalId, status: 'pending' });
      break;
    }

    case 'capture_pcap': {
      const { incident_id, time_window = 5, filter_expr } = args || {};
      if (!incident_id) {
        res.status(400).json({ error: 'missing incident_id' });
        return;
      }

      // 修复：移除重复实现，直接复用 forensics 路由的核心逻辑
      // 由于无法直接 import router 中的私有函数，这里保留最小必要的触发逻辑，但确保路径和配置与 forensics.routes.ts 完全一致
      
      // 1. 验证事件单存在
      const incidentCheck = await pool.query('SELECT id FROM incidents WHERE id = $1', [incident_id]);
      if (incidentCheck.rowCount === 0) {
        res.status(404).json({ error: 'incident not found' });
        return;
      }

      // 2. 创建任务记录
      const taskId = crypto.randomUUID();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      // 修复：使用与 forensics.routes.ts 相同的环境变量解析逻辑
      const pcapDir = process.env.PCAP_DIR || path.resolve(__dirname, '../../../../storage/pcap');
      const pcapFilename = `capture-${incident_id}-${ts}.pcap`;
      const pcap_path = path.join(pcapDir, pcapFilename);

      await pool.query(
        `INSERT INTO forensics (id, incident_id, status, pcap_path, filter_expr, time_window_minutes, requested_by)
         VALUES ($1, $2, 'queued', $3, $4, $5, $6)`,
        [taskId, incident_id, pcap_path, filter_expr || null, time_window, 'mcp-agent']
      );

      // 3. 写入 Redis 状态
      const redisKey = buildRedisKey('waf:mvp:forensics', 'task', taskId);
      await setRedisJson(redisKey, {
        task_id: taskId,
        incident_id,
        status: 'queued',
        progress: 0,
        updated_at: new Date().toISOString()
      }, (time_window * 60) + 1800);

      // 4. 异步触发 Worker (复用逻辑，确保参数一致)
      setImmediate(() => {
        // 直接调用本文件中定义的 helper，确保行为一致
        triggerForensicsWorker(taskId, pcap_path, filter_expr || null, time_window, incident_id)
          .catch((err) => console.error('[mcp-capture] worker trigger failed:', err));
      });

      res.json({ success: true, task_id: taskId, status: 'queued', download_url: `/api/forensics/${taskId}/download` });
      break;
    }

    case 'get_forensics': {
      const { incident_id } = args || {};
      if (!incident_id) {
        res.status(400).json({ error: 'missing incident_id' });
        return;
      }
      const result = await pool.query('SELECT * FROM forensics WHERE incident_id = $1 ORDER BY created_at DESC', [incident_id]);
      res.json({ success: true, data: result.rows });
      break;
    }

    case 'get_pcap_meta': {
      const { fid } = args || {};
      if (!fid) {
        res.status(400).json({ error: 'missing fid' });
        return;
      }
      const result = await pool.query('SELECT id, sha256, size_bytes, status FROM forensics WHERE id = $1', [fid]);
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'forensics task not found' });
        return;
      }
      res.json({ success: true, data: result.rows[0] });
      break;
    }

    default:
      res.status(400).json({ error: `unsupported tool: ${tool}` });
  }
}));

/**
 * 内部辅助函数：触发取证 Worker
 * 从 forensics.routes.ts 复制过来以避免循环依赖，或提取到 service 层
 */
async function triggerForensicsWorker(
  taskId: string,
  pcap_path: string,
  filterExpr: string | null,
  timeWindowMinutes: number,
  incidentId: string
): Promise<void> {
  const redisKey = buildRedisKey('waf:mvp:forensics', 'task', taskId);
  
  try {
    await pool.query(`UPDATE forensics SET status = 'processing' WHERE id = $1`, [taskId]);
    await setRedisJson(redisKey, { task_id: taskId, incident_id: incidentId, status: 'processing', progress: 50, updated_at: new Date().toISOString() }, (timeWindowMinutes * 60) + 1800);

    const workerPath = path.resolve(__dirname, '../../../../services/forensics-worker/src/capture.py');
    const outputDir = path.dirname(pcap_path);
    
    // 构造后端回调 URL (Docker 环境下使用服务名)
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';

    return new Promise((resolve, reject) => {
      const args = [
        '--interface', 'any',
        '--duration', String(timeWindowMinutes * 60),
        '--output-dir', outputDir,
        '--task-id', taskId,
        '--incident-id', incidentId,
        '--backend-url', backendUrl // 传递回调地址
      ];
      if (filterExpr) args.push('--filter', filterExpr);

      const worker = spawn('python3', [workerPath, ...args]);
      let stderr = '';
      worker.stderr.on('data', (data) => { stderr += data.toString(); });

      worker.on('close', async (code) => {
        if (code === 0 && fs.existsSync(pcap_path)) {
          // 注意：实际生产中 sha256 应由 worker 计算并通过回调上报，此处仅为本地调试兼容
          // 严格模式下应等待回调更新，这里简化处理直接标记完成（依赖 worker 回调覆盖）
          resolve(); 
        } else {
          await pool.query(`UPDATE forensics SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`, [`exit ${code}: ${stderr}`, taskId]);
          await delRedisKey(redisKey);
          reject(new Error(stderr));
        }
      });
      worker.on('error', reject);
    });
  } catch (e) {
    await pool.query(`UPDATE forensics SET status = 'failed', error_message = $1 WHERE id = $2`, [(e as Error).message, taskId]);
    await delRedisKey(redisKey);
    throw e;
  }
}

export { router as mcpRouter };
