# infrastructure/waf/runtime 板块说明

## 板块内容
- `main.conf`：WAF 运行入口。
- `coraza.conf`：引擎基础配置。
- `10-project-overrides.conf`：项目覆盖参数。
- `crs-setup.conf`：CRS 配置模板。
- `rules/`：CRS 规则文件。

## 边界
- 仅维护可加载的运行时规则资产。
- 不处理应用层业务状态。

## 对外接口
- WAF 运行入口：`main.conf`
- 日志输出路径：`storage/logs/waf-audit.log`

## 关键函数/入口
- 入口配置文件：main.conf。
