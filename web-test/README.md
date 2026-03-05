# web-test

`web-test` 是一个真实可访问的“无业务内容网站”样例，用于 WAF/CRS 联调。

## 站点定位

- 内容展示站：文章列表、文章详情、搜索、资料页。
- 不包含订单、支付、注册、充值等业务流程。
- 保留受控安全测试入口，用于验证规则集命中。

## 已保留攻击场景

1. SQL 注入：`POST /api/auth/login`
2. 反射型 XSS：`GET /search?q=...`
3. 命令注入探测：`POST /api/tools/ping-preview`
4. 附加（路径穿越探测）：`GET /legacy/download?name=../../etc/passwd`

说明：
- `GET /legacy/download` 是公开的历史遗留下载入口（用于探测），不是隐藏后门实现。

## 快速启动

```bash
cd web-test
npm install
npm run dev
```

默认地址：`http://127.0.0.1:8080`

## 关键入口

- 服务入口：`src/server.js`
- 应用装配：`src/app.js`
- 页面/API 路由：`src/routes/*.routes.js`
- 契约文档：`docs/*`
