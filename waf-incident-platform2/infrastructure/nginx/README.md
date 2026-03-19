# Nginx/OpenResty 入口层

## 板块内容

- 反向代理入口配置（待按部署环境补齐）。
- 与 WAF 审计日志字段约定。

## 边界

- 只负责入口转发、TLS、日志格式。
- 不承载业务 API 逻辑。

## 对外接口

- 预期输入：外部 HTTP/HTTPS 请求。
- 预期输出：转发至后端服务与审计日志。

## 关键配置文件（建议）

- `nginx.conf`
- `sites-enabled/*.conf`
- 日志格式模板（包含 `request_id`、真实来源 IP）
