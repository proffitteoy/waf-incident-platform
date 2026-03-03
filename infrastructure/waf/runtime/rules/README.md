# infrastructure/waf/runtime/rules 板块说明

## 板块内容
- OWASP CRS 规则文件。
- 项目规则排除与覆盖规则。

## 边界
- 仅维护 SecLang 规则，不承载应用逻辑。

## 对外接口
- 由 `infrastructure/waf/runtime/main.conf` 通过 `Include rules/*.conf` 加载。

## 关键函数/入口
- 规则板块，无业务函数。入口由 Include rules/*.conf 驱动。
