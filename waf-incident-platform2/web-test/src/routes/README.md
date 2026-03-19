# routes

## 板块内容

- `pages.routes.js`：内容网站页面路由与遗留下载入口
- `api.routes.js`：安全联调 API（SQLi/XSS/命令注入探测等）

## 边界

- 仅负责参数解析与响应拼装
- 复杂逻辑下沉到 `../services`

## 对外接口

- 页面：`/`、`/about`、`/articles`、`/articles/:slug`、`/search`、`/legacy/download`
- API：`/api/*`

## 关键函数/入口

- `router.get/post(...)`
