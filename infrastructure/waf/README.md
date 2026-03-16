# WAF/CRS 规则层

## 板块内容

- 引擎： modsecurity
- 规则：OWASP CRS v4
- 运行目录：`infrastructure/waf/runtime`
  - `main.conf`：统一加载入口
  - `modsecurity3.conf`：引擎基线
  - `10-project-overrides.conf`：项目覆盖配置
  - `crs-setup.conf`：CRS 参数配置
  - `rules/*.conf`：规则文件

## 边界

- 本目录只维护规则与引擎配置资产。
- 不负责后端事件单、审批、LLM 分析逻辑。

## 对外接口

- WAF 审计日志路径：`storage/logs/waf-audit.log`
- 审计格式：JSON
- 导入脚本：`scripts/import-waf-assets.ps1`

## 关键函数/入口

- 入口配置：`runtime/main.conf`
- 加载顺序：`modsecurity3.conf -> 10-project-overrides.conf -> crs-setup.conf -> rules/*.conf`
