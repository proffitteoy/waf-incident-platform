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

默认地址：`http://127.0.0.1:8008`

## 通过 WAF 的攻击回放（Windows）

说明：
- 要验证 WAF 命中与审计，请请求 `http://127.0.0.1:80`（WAF 入口），不要直打 `8008`。
- 在 `cmd` 下请使用 `curl.exe`，并使用单行命令，避免 `\\` 或 Linux 续行写法导致参数解析错误。

### CMD（curl.exe）

```bat
curl.exe -i "http://127.0.0.1:80/search?q=%3Cscript%3Ealert(1)%3C/script%3E"

curl.exe -i -X POST "http://127.0.0.1:80/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"admin' OR '1'='1\",\"password\":\"demo\"}"

curl.exe -i -X POST "http://127.0.0.1:80/api/tools/ping-preview" -H "Content-Type: application/json" -d "{\"host\":\"8.8.8.8;cat /etc/passwd\"}"

curl.exe -i "http://127.0.0.1:80/legacy/download?name=../../etc/passwd"
```

### PowerShell（推荐）

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:80/search?q=%3Cscript%3Ealert(1)%3C/script%3E" -Method Get

$body = @{ username = "admin' OR '1'='1"; password = "demo" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://127.0.0.1:80/api/auth/login" -Method Post -ContentType "application/json" -Body $body

$body = @{ host = "8.8.8.8;cat /etc/passwd" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://127.0.0.1:80/api/tools/ping-preview" -Method Post -ContentType "application/json" -Body $body

Invoke-WebRequest -Uri "http://127.0.0.1:80/legacy/download?name=../../etc/passwd" -Method Get
```

验证日志：

```powershell
Get-Content .\storage\logs\waf-audit.log -Tail 1
```

## 关键入口

- 服务入口：`src/server.js`
- 应用装配：`src/app.js`
- 页面/API 路由：`src/routes/*.routes.js`
- 契约文档：`docs/*`
