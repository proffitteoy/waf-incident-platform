# MCP Tools 契约（MVP）

## 入口

- `GET /api/mcp/tools`：返回工具列表
- `POST /api/mcp/invoke`：执行工具调用

## 工具清单（与代码一致）

### 只读查询

- `query_incidents(status)`
- `get_incident(incident_id)`
- `query_events(src_ip, limit)`
- `get_policies()`
- `get_recent_stats(range)`

### 分析

- `analyze_incident(incident_id, actor)`

输出建议字段：
- `attack_chain[]`
- `key_iocs[]`
- `risk_assessment`
- `recommended_actions_low[]`
- `recommended_actions_high[]`

### 低危自动处置

- `apply_rate_limit(incident_id, target|ip, scope, ttl, reason, actor)`
- `block_ip_temp(incident_id, target|ip, scope, ttl, reason, actor)`
- `challenge_ip(incident_id, target|ip, scope, ttl, reason, actor)`
- `rollback_action(action_id)`

副作用：
- 会写 `actions` 表。
- 成功动作会写 Redis 动作状态键（TTL）。
- 回滚会尝试清理对应 Redis 动作状态键。

### 高危请示与取证

- `create_approval_request(incident_id, action_plan, risk_level, requested_by, justification)`
- `capture_pcap(incident_id, time_window, filter_expr)`
- `get_forensics(incident_id)`
- `get_pcap_meta(fid)`

## 错误语义

- 不支持工具：`400 unsupported tool`
- 资源不存在：`404`（如 incident/action 不存在）

## 维护要求

- 工具名、参数、行为必须与 `backend/src/api/routes/mcp.routes.ts` 同步。
- 新增工具时必须同步更新：`docs/api-spec.md`、`docs/技术细节.md`。
