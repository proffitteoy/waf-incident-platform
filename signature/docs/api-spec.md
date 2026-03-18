# REST API 契约（signature 取证模块）

## 说明

- 基础前缀：`/api`
- 本文档记录 signature 目录的取证接口契约，与主项目 `docs/api-spec.md` 保持一致

## 健康检查

- `GET /health`
  - 返回：`ok/postgres` 状态

## 取证接口

### POST /api/incidents/:id/forensics/capture

- **用途**：触发抓包任务，写入 `forensics` 表，状态初始为 `queued`
- **参数**：
  - `id` (path): 事件单 ID
  - `time_window_minutes` (body, optional): 抓包时间窗口（分钟），默认 5
  - `filter_expr` (body, optional): BPF 过滤表达式
- **响应**（202）：
  ```json
  {
    "code": 202,
    "data": {
      "forensics_id": "uuid",
      "incident_id": "uuid",
      "status": "queued",
      "capture_window": {
        "start": "2026-03-04T10:00:00Z",
        "end": "2026-03-04T10:05:00Z"
      },
      "filter_expr": "host 192.168.1.1"
    }
  }