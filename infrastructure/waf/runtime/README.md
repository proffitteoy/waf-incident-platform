# infrastructure/waf/runtime 板块说明

## 板块内容
- `main.conf`：WAF 运行入口。
- `modsecurity3.conf`：引擎基础配置。
- `10-project-overrides.conf`：项目覆盖参数。
- `crs-setup.conf`：CRS 配置模板。
- `access_check.lua`：网关执行器（读取 Redis 动作状态并执行 block/challenge/rate_limit）。
- `rules/`：CRS 规则文件。

## 边界
- 仅维护可加载的运行时规则资产。
- 不处理应用层业务状态。

## 对外接口
- WAF 运行入口：`main.conf`
- 日志输出路径：`storage/logs/waf-audit.log`
- 执行确认回传：命中策略后由 `access_check.lua` 触发内部回调，转发到后端 `/api/actions/enforcement/confirm`。

## 关键函数/入口
- 入口配置文件：main.conf。
- 执行器入口：`access_check.lua -> check_policy()`。
