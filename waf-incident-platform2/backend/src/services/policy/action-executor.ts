import { pool } from '../../core/db/pool';
import { buildRedisKey, setRedisJson, delRedisKey } from '../../core/cache/redis';

export interface ActionPlan {
  action_type: 'rate_limit' | 'block_ip' | 'challenge';
  scope: 'ip' | 'uri' | 'user_agent';
  target: string;
  ttl_seconds: number;
  incidentId?: string;
  id?: string;
}

interface ActionRecord {
  scope: string;
  action_type: string;
  target: string;
}

export async function executeAction(actionPlan: ActionPlan): Promise<void> {
  // 1. 写入 actions 表（事实记录）
  await pool.query(
    `INSERT INTO actions (action_type, scope, target, ttl_seconds, incident_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      actionPlan.action_type,
      actionPlan.scope,
      actionPlan.target,
      actionPlan.ttl_seconds,
      actionPlan.incidentId ?? null
    ]
  );

  // 2. 写入 Redis 动作状态键（网关可读）
  const redisKey = buildRedisKey('waf:mvp', 'active_action', actionPlan.scope, actionPlan.action_type, actionPlan.target);
  await setRedisJson(redisKey, {
    action_type: actionPlan.action_type,
    target: actionPlan.target,
    incident_id: actionPlan.incidentId,
    expires_at: Date.now() + (actionPlan.ttl_seconds * 1000)
  }, actionPlan.ttl_seconds);
}

export async function rollbackAction(actionId: string): Promise<void> {
  // 1. 查询原动作
  const action = await pool.query<ActionRecord>(
    `SELECT scope, action_type, target FROM actions WHERE id = $1`,
    [actionId]
  );

  if (action.rowCount === 0 || !action.rows[0]) {
    throw new Error(`Action ${actionId} not found`);
  }

  const original = action.rows[0];

  // 2. 清理 Redis 状态键
  const redisKey = buildRedisKey('waf:mvp', 'active_action', original.scope, original.action_type, original.target);
  await delRedisKey(redisKey);

  // 3. 写入回滚动作记录
  await pool.query(
    `INSERT INTO actions (action_type, scope, target, result, created_at)
     VALUES ('rollback', $1, $2, 'success', NOW())`,
    [original.scope, original.target]
  );
}