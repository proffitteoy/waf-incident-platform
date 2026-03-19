# WAF 规则集对接说明（web-test）

## 文档目的

说明 web-test 与 Coraza + OWASP CRS 的联调方式。

## 适用范围/边界

- 规则资产路径：`infrastructure/waf/runtime/rules`。
- web-test 只负责提供真实请求入口，不实现规则引擎。

## 当前实现状态（2026-03-05）

- 内容站能力：首页、文章、搜索、资料页。
- 攻击回放入口：SQLi/XSS/命令注入探测 + 路径穿越探测（附加）。

## 对接步骤

1. 启动 web-test：

```bash
cd web-test
npm install
npm run dev
```

2. 启动 WAF 并把上游指向 `http://web-test:8080`（或本机映射地址）。

3. 使用 `docs/testing.md` 的 curl 命令进行回放。

## 推荐验证项

- SQL 注入请求：942xxx 规则族
- XSS 请求：941xxx 规则族
- 命令注入探测请求：932xxx 规则族
- 路径穿越请求：930xxx 规则族

## 变更影响

- 攻击入口路径变化后必须同步更新 `api-spec.md` 与 `testing.md`。
