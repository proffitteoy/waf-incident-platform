# 测试与攻击回放说明

## 文档目的

定义 web-test 的自动化测试与攻击场景回放方法。

## 适用范围/边界

- 测试目录：`web-test/test`
- 仅验证请求链路，不执行真实系统命令。

## 当前实现状态（2026-03-05）

- Node 内置测试：`test/security-scenarios.test.js`
- 覆盖健康检查、SQLi、命令注入探测、路径穿越探测。

## 自动化测试

```bash
cd web-test
npm install
npm test
```

## 手工回放（curl）

### 1) SQL 注入

```bash
curl -i -X POST "http://127.0.0.1:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin'"'"' OR '"'"'1'"'"'='"'"'1","password":"demo"}'
```

### 2) XSS

```bash
curl -i "http://127.0.0.1:8080/search?q=%3Cscript%3Ealert(1)%3C/script%3E"
```

### 3) 命令注入探测

```bash
curl -i -X POST "http://127.0.0.1:8080/api/tools/ping-preview" \
  -H "Content-Type: application/json" \
  -d '{"host":"8.8.8.8;cat /etc/passwd"}'
```

### 4) 路径穿越探测（附加）

```bash
curl -i "http://127.0.0.1:8080/legacy/download?name=../../etc/passwd"
```

## 发布门禁建议

- `npm test` 必须通过。
- 回放请求应可到达应用入口（拦截策略由 WAF 决定）。
- 不允许出现真实命令执行行为。

## 变更影响

- 新增攻击场景后必须补充测试用例与回放命令。
