# WAF 规则集与引擎集成说明

## 目标

将 Coraza 引擎与 OWASP CRS 规则集导入到项目运行目录，并与后端闭环打通。

## 本地资产来源

推荐将上游仓库放在项目同级目录：

- `../coraza-main`
- `../coreruleset-main`

也可放在其他路径，通过脚本参数覆盖。

## 导入脚本

- 脚本：`scripts/import-waf-assets.ps1`
- 默认参数：
  - `CorazaSource = ..\coraza-main`
  - `CrsSource = ..\coreruleset-main`

示例：

```powershell
.\scripts\import-waf-assets.ps1
```

或指定路径：

```powershell
.\scripts\import-waf-assets.ps1 -CorazaSource "D:\repos\coraza-main" -CrsSource "D:\repos\coreruleset-main"
```

## 项目内落地位置

- 入口配置：`infrastructure/waf/runtime/main.conf`
- 覆盖策略：`infrastructure/waf/runtime/10-project-overrides.conf`
- 规则目录：`infrastructure/waf/runtime/rules`

## 与后端对接点

1. 审计日志使用 JSON 输出。
2. 日志写入 `storage/logs/waf-audit.log`。
3. 后端 ingestion 将日志映射到 `events_raw`，供 LLM 分析、策略处置与审计使用。

## 上线建议节奏

1. `DetectionOnly + 审计`（调参与误报治理）
2. 低危自动处置（`rate_limit/challenge`）
3. 高危审批后拦截（`block`）
4. 明确攻击触发 tshark 取证
