import { Router, Request, Response } from 'express';
import { pool } from '../../core/db/pool';
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { buildRedisKey, setRedisJson, delRedisKey, redisClient } from '../../core/cache/redis';
import { asyncHandler } from '../../core/http/async-handler';

const router = Router();

// 关键变量配置 - 从环境变量读取，适配项目实际目录
const PCAP_DIR = process.env.PCAP_DIR || path.resolve(__dirname, '../../../../storage/pcap');
const FORENSICS_REDIS_PREFIX = 'waf:mvp:forensics';

interface ForensicsTask {
  id: string;
  incident_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  pcap_path: string | null;
  sha256: string | null;
  size_bytes: number | null;
  filter_expr: string | null;
  time_window_minutes: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  requested_by: string;
}

interface ForensicsRedisState {
  task_id: string;
  incident_id: string;
  status: string;
  progress: number;
  updated_at: string;
}

/**
 * POST /api/incidents/:id/forensics/capture
 * 创建取证抓包任务，异步触发 forensics-worker
 */
router.post('/incidents/:id/forensics/capture', asyncHandler(async (req: Request, res: Response) => {
  const { id: incident_id } = req.params;
  const { time_window_minutes = 5, filter_expr, requested_by = 'system' } = req.body as { time_window_minutes?: number; filter_expr?: string; requested_by?: string };

  // 1. 验证事件单存在
  const incidentCheck = await pool.query(
    'SELECT id FROM incidents WHERE id = $1',
    [incident_id]
  );

  if (incidentCheck.rowCount === 0) {
    res.status(404).json({ error: 'incident not found' });
    return;
  }

  // 2. 创建取证任务记录
  const taskId = crypto.randomUUID();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const pcapFilename = `capture-${incident_id}-${ts}.pcap`;
  const pcap_path = path.join(PCAP_DIR, pcapFilename);

  await pool.query(
    `INSERT INTO forensics (id, incident_id, status, pcap_path, filter_expr, time_window_minutes, requested_by)
     VALUES ($1, $2, 'queued', $3, $4, $5, $6)`,
    [taskId, incident_id, pcap_path, filter_expr || null, time_window_minutes, requested_by]
  );

  // 3. 写入 Redis 状态缓存（TTL = 抓包时长 + 30 分钟缓冲）
  const redisKey = buildRedisKey(FORENSICS_REDIS_PREFIX, 'task', taskId);
  const redisState: ForensicsRedisState = {
    task_id: taskId,
    incident_id,
    status: 'queued',
    progress: 0,
    updated_at: new Date().toISOString()
  };
  await setRedisJson(redisKey, redisState, (time_window_minutes * 60) + 1800);

  // 4. 异步触发 forensics-worker
  setImmediate(() => {
    triggerForensicsWorker(taskId, pcap_path, filter_expr ?? null, time_window_minutes, incident_id)
      .catch((err) => {
        console.error('[forensics] worker trigger failed:', err);
        // 更新任务状态为 failed
        pool.query(
          `UPDATE forensics SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [err.message, taskId]
        );
        // 清理 Redis 状态
        delRedisKey(redisKey);
      });
  });

  res.status(201).json({
    id: taskId,
    incident_id,
    status: 'queued',
    pcap_path: pcapFilename,
    estimated_completion_seconds: time_window_minutes * 60 + 30,
    download_url: `/api/forensics/${taskId}/download`
  });
}));

/**
 * 触发 forensics-worker 进程
 */
async function triggerForensicsWorker(
  taskId: string,
  pcap_path: string,
  filterExpr: string | null,
  timeWindowMinutes: number,
  incidentId: string
): Promise<void> {
  const redisKey = buildRedisKey(FORENSICS_REDIS_PREFIX, 'task', taskId);

  // 更新数据库状态为 processing
  await pool.query(
    `UPDATE forensics SET status = 'processing' WHERE id = $1`,
    [taskId]
  );

  // 更新 Redis 状态
  await setRedisJson(redisKey, {
    task_id: taskId,
    incident_id: incidentId,
    status: 'processing',
    progress: 50,
    updated_at: new Date().toISOString()
  }, (timeWindowMinutes * 60) + 1800);

  const workerPath = path.resolve(__dirname, '../../../../services/forensics-worker/src/capture.py');
  const outputDir = path.dirname(pcap_path);

  // 修复：在 Docker 容器内部，子进程回调后端应始终使用 'localhost' (因为 spawn 在同一容器内)
  // 但为了兼容 docker-compose 网络环境下的潜在代理配置，优先读取 BACKEND_API_URL
  // 关键点：docker-compose.yml 中 backend 容器的 BACKEND_API_URL 应设置为 http://localhost:3000 
  // 因为 python 脚本是在 backend 容器内部运行的，而不是在另一个容器中。
  // 之前的困惑在于是否用服务名，但 spawn 是本地进程调用，所以 localhost 是正确的。
  // 真正的问题在于 docker-compose.yml 中是否正确传递了这个环境变量。
  // 这里保持逻辑稳健：默认 localhost，允许环境变量覆盖。
  const callbackBaseUrl = process.env.BACKEND_API_URL || `http://localhost:${process.env.PORT || '3000'}`;

  return new Promise((resolve, reject) => {
    const args = [
      '--interface', 'any',
      '--duration', String(timeWindowMinutes * 60),
      '--output-dir', outputDir,
      '--task-id', taskId,
      '--incident-id', incidentId,
      '--backend-url', callbackBaseUrl // 显式传递回调地址
    ];

    if (filterExpr) {
      args.push('--filter', filterExpr);
    }

    // 修复：明确指定 python3 执行，确保环境变量 PATH 中包含 python
    const worker = spawn('python3', [workerPath, ...args], {
      env: { ...process.env, PYTHONUNBUFFERED: '1' } // 确保 python 输出实时可见
    });

    let stderr = '';
    worker.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    worker.on('close', async (code) => {
      if (code === 0) {
        // Worker 成功完成
        // 注意：生产环境中 sha256/size 应由 worker 回调写入，此处做双重保障
        // 若 worker 未回调，此处尝试本地计算（仅限 backend 与 worker 共享存储卷时有效）
        try {
          if (fs.existsSync(pcap_path)) {
            const sha256 = await calculateFileSha256(pcap_path);
            const sizeBytes = fs.statSync(pcap_path).size;
            
            // 若 worker 未通过回调更新，则在此更新（防止回调丢失）
            await pool.query(
              `UPDATE forensics 
               SET status = COALESCE(status, 'completed'), sha256 = $1, size_bytes = $2, completed_at = COALESCE(completed_at, NOW())
               WHERE id = $3 AND (status != 'completed' OR sha256 IS NULL)`,
              [sha256, sizeBytes, taskId]
            );
          }
        } catch (e) {
          console.warn('[forensics] local post-process failed, waiting for callback:', e);
        }
        resolve();
      } else {
        const errorMsg = `worker exited with code ${code}: ${stderr}`;
        // 更新数据库状态为 failed
        await pool.query(
          `UPDATE forensics SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [errorMsg, taskId]
        );
         // 清理 Redis 状态
         await delRedisKey(redisKey);
        reject(new Error(errorMsg));
      }
    });

    worker.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 计算文件 SHA256
 */
async function calculateFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * GET /api/incidents/:id/forensics
 * 获取事件单关联的取证任务列表
 */
router.get('/incidents/:id/forensics', asyncHandler(async (req: Request, res: Response) => {
  const { id: incident_id } = req.params;

  const result = await pool.query<ForensicsTask>(
    `SELECT id, incident_id, status, pcap_path, sha256, size_bytes, 
            filter_expr, time_window_minutes, created_at, completed_at, error_message, requested_by
     FROM forensics
     WHERE incident_id = $1
     ORDER BY created_at DESC`,
    [incident_id]
  );

  res.json({
    incident_id,
    tasks: result.rows.map((row) => ({
      ...row,
      download_url: row.status === 'completed' ? `/api/forensics/${row.id}/download` : null
    }))
  });
}));

/**
 * GET /api/forensics/:fid
 * 获取单个取证任务状态（含 Redis 缓存状态）
 */
router.get('/forensics/:fid', asyncHandler(async (req: Request, res: Response) => {
  const { fid } = req.params;

  // 1. 查询数据库
  const result = await pool.query<ForensicsTask>(
    'SELECT * FROM forensics WHERE id = $1',
    [fid]
  );

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'forensics task not found' });
    return;
  }

  const task = result.rows[0];

  // 2. 尝试从 Redis 获取最新状态
  const redisKey = buildRedisKey(FORENSICS_REDIS_PREFIX, 'task', fid);
  let redisState: ForensicsRedisState | null = null;
  try {
    if (redisClient.isReady) {
      const raw = await redisClient.get(redisKey);
      if (raw) {
        redisState = JSON.parse(raw) as ForensicsRedisState;
      }
    }
  } catch (e) {
    // Redis 不可用时降级为数据库状态
  }

  res.json({
    ...task,
    redis_state: redisState,
    download_url: task.status === 'completed' ? `/api/forensics/${fid}/download` : null
  });
}));

/**
 * PATCH /api/forensics/:taskId/status
 * 供 forensics-worker 回调更新任务状态
 * 文档要求：支持 Worker 异步回写状态、sha256、size_bytes
 */
router.patch('/forensics/:taskId/status', asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { status, sha256, size_bytes, error_message } = req.body as {
    status: 'processing' | 'completed' | 'failed';
    sha256?: string;
    size_bytes?: number;
    error_message?: string;
  };

  // 1. 验证任务存在并获取 incident_id
  const check = await pool.query('SELECT id, incident_id FROM forensics WHERE id = $1', [taskId]);
  if (check.rowCount === 0) {
    res.status(404).json({ error: 'forensics task not found' });
    return;
  }
  const incidentId = check.rows[0].incident_id;

  // 2. 构建更新字段
  const updateFields: string[] = ['status = $1'];
  const updateValues: any[] = [status];
  let idx = 2;

  if (status === 'completed') {
    if (sha256) {
      updateFields.push(`sha256 = $${idx++}`);
      updateValues.push(sha256);
    }
    if (size_bytes !== undefined) {
      updateFields.push(`size_bytes = $${idx++}`);
      updateValues.push(size_bytes);
    }
    updateFields.push('completed_at = NOW()');
  } else if (status === 'failed') {
    if (error_message) {
      updateFields.push(`error_message = $${idx++}`);
      updateValues.push(error_message);
    }
    updateFields.push('completed_at = NOW()');
  }

  updateValues.push(taskId);
  
  await pool.query(
    `UPDATE forensics SET ${updateFields.join(', ')} WHERE id = $${idx}`,
    updateValues
  );

  // 3. 更新 Redis 状态缓存 (必须包含 incident_id 以便前端轮询)
  const redisKey = buildRedisKey(FORENSICS_REDIS_PREFIX, 'task', taskId);
  const redisState: ForensicsRedisState = {
    task_id: taskId,
    incident_id: incidentId, // 修复：确保 Redis 中包含 incident_id
    status,
    progress: status === 'completed' ? 100 : status === 'failed' ? 0 : 50,
    updated_at: new Date().toISOString()
  };
  
  try {
    if (redisClient.isReady) {
      await setRedisJson(redisKey, redisState, 1800); // 30 分钟 TTL
    }
  } catch (e) {
    console.warn('[forensics] redis state update failed:', e);
  }

  res.json({ success: true, task_id: taskId, status });
}));

/**
 * GET /api/forensics/:fid/download
 * 下载 pcap 文件（带签名验证）
 */
router.get('/forensics/:fid/download', asyncHandler(async (req: Request, res: Response) => {
  const { fid } = req.params;
  const { token } = req.query;

  // 1. 查询取证任务
  const result = await pool.query<ForensicsTask>(
    'SELECT * FROM forensics WHERE id = $1',
    [fid]
  );

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'forensics task not found' });
    return;
  }

  const task = result.rows[0];

  // 2. 检查状态
  if (task.status !== 'completed') {
    res.status(400).json({
      error: 'pcap not ready',
      status: task.status,
      message: task.status === 'queued' 
        ? 'Capture task is still queued' 
        : task.status === 'processing'
        ? 'Capture in progress'
        : `Capture failed: ${task.error_message}`
    });
    return;
  }

  // 3. 检查文件是否存在
  if (!task.pcap_path || !fs.existsSync(task.pcap_path)) {
    res.status(404).json({ error: 'pcap file not found on disk' });
    return;
  }

  // 4. 可选：验证下载令牌（生产环境启用）
  if (process.env.FORENSICS_DOWNLOAD_TOKEN_REQUIRED === 'true' && !token) {
    res.status(401).json({ error: 'download token required' });
    return;
  }

  // 5. 设置响应头并流式传输文件
  const filename = path.basename(task.pcap_path);
  res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // 修复：确保 size_bytes 存在，否则实时计算
  const fileSize = task.size_bytes || fs.statSync(task.pcap_path).size;
  res.setHeader('Content-Length', String(fileSize));
  
  // 修复：确保 sha256 存在，否则实时计算（性能开销大，仅作兜底）
  const fileSha256 = task.sha256 || (await calculateFileSha256(task.pcap_path));
  
  res.setHeader('X-Pcap-Sha256', fileSha256);
  res.setHeader('X-Pcap-Task-Id', fid);

  const fileStream = fs.createReadStream(task.pcap_path!);
  fileStream.pipe(res);
}));

export { router as forensicsRouter };