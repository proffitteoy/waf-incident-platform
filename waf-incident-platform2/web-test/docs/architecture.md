# 系统架构（web-test MVP）

## 文档目的

描述 web-test 当前落地形态，作为 WAF/CRS 联调目标站点。

## 架构目标

构建一个真实无业务内容站，并保留受控攻击输入入口：

`Browser/CLI -> Express Routes -> Services -> Views/Data -> Response`

在 WAF 前置部署时：

`Browser/CLI -> Nginx/OpenResty + Coraza + CRS -> web-test -> Response`

## 分层与边界

1. **入口层（可选外置）**
- `infrastructure/waf/runtime/*`
- 负责规则匹配、拦截、审计。

2. **页面/API 路由层（`web-test/src/routes`）**
- `pages.routes.js`：内容页、搜索页、遗留下载入口
- `api.routes.js`：攻击场景 API

3. **服务层（`web-test/src/services`）**
- `content.service.js`：文章内容数据
- `auth.service.js`：登录与 SQL 字符串构造
- `command-preview.service.js`：命令预览构造（不执行）
- `file.service.js`：文件读取与目录边界限制

4. **展示层（`web-test/src/views` + `web-test/public`）**
- EJS 模板页面
- CSS 样式

5. **数据层（`web-test/data/files`）**
- 演示资料文件

## 当前关键实现点（2026-03-05）

- 网站已改为内容站：首页、关于、文章列表与详情、搜索页。
- 保留 SQLi/XSS/命令注入探测 3 类最小攻击入口。
- 增加 `GET /legacy/download` 作为路径穿越探测入口（附加场景）。
- 命令注入接口仅返回命令拼接结果，不执行系统命令。

## 变更影响

- 攻击入口变化需同步 `api-spec.md`、`testing.md`、`waf-integration.md`。
- 架构节点变化需同步 `canvas-dev/project.canvas` 与 `技术细节.md`。
