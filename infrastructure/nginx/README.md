# Nginx/OpenResty 入口层

## 板块内容

- 反向代理入口配置（待按部署环境补齐）。
- 与 WAF 审计日志字段约定。
- 网关执行确认回传入口（OpenResty 内部 location）。

## 边界

- 只负责入口转发、TLS、日志格式。
- 不承载业务 API 逻辑。

## 对外接口

- 预期输入：外部 HTTP/HTTPS 请求。
- 预期输出：转发至后端服务与审计日志。
- 内部接口：`/__policy/enforcement-confirm`（仅内部调用，转发到后端 `/api/actions/enforcement/confirm`）。

## 关键配置文件（建议）

- `nginx.conf`
- `sites-enabled/*.conf`
- 日志格式模板（包含 `request_id`、真实来源 IP）

## 关键环境变量

- `BACKEND_API_URL`：执行确认回传目标（默认后端 `POST /api/actions/enforcement/confirm`）。
- `ACTUATOR_CONFIRM_TOKEN`：可选，透传给后端做确认接口鉴权。
