# REST API 契约（web-test MVP）

## 文档目的

定义 web-test 当前对外可用页面与 API 契约。

## 适用范围/边界

- 仅覆盖 `web-test/src/routes/*.routes.js` 已挂载路径。
- 站点定位为“无业务内容网站”，攻击入口仅用于规则联调。

## 健康检查

- `GET /health`
  - 返回：`ok/service/time`

## 页面路由

- `GET /`
- `GET /about`
- `GET /articles`
- `GET /articles/:slug`
- `GET /search?q=...`
- `GET /files?name=...`
- `GET /legacy/download?name=...`
- `GET /attack-lab`

说明：
- `GET /search` 会原样回显 `q`（反射型 XSS 演示）。
- `GET /legacy/download` 是历史遗留下载入口，用于路径穿越探测。

## API 路由（前缀 `/api`）

- `GET /api/attack-scenarios`
- `POST /api/auth/login`
- `GET /api/search?q=...`
- `POST /api/tools/ping-preview`
- `GET /api/files/read?name=...`

### `POST /api/auth/login`

请求体：

```json
{
  "username": "admin' OR '1'='1",
  "password": "anything"
}
```

返回字段：
- `ok`
- `message`
- `sql_preview`
- `user`

### `POST /api/tools/ping-preview`

请求体：

```json
{
  "host": "8.8.8.8;cat /etc/passwd"
}
```

返回字段：
- `ok`
- `command_preview`
- `executed`（固定 `false`）

## 攻击场景契约

1. SQL 注入：`POST /api/auth/login`
2. 反射型 XSS：`GET /search?q=...`
3. 命令注入探测：`POST /api/tools/ping-preview`
4. 路径穿越探测（附加）：`GET /legacy/download?name=../../etc/passwd`

## 当前实现状态

- 已实现并可本地访问。
- 尚未接入真实数据库与账户系统。

## 变更影响

- 任一路由/参数变化必须同步更新本文件与 `技术细节.md`。
