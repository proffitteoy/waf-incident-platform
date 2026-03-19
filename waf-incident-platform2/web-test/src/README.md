# src

## 板块内容

- Express 应用装配与启动入口
- 内容站页面路由与安全演练 API
- 业务服务（内容、登录、命令预览、文件读取）

## 边界

- 仅处理 Web 请求与演示逻辑
- 不执行系统级命令，不接入真实交易业务

## 对外接口

- 页面：`/`、`/about`、`/articles`、`/articles/:slug`、`/search`、`/legacy/download`
- API：`/api/*`

## 关键函数/入口

- `app.js#createApp`
- `server.js`
