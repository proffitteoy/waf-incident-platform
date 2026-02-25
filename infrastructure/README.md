# infrastructure 板块说明

## 板块内容
- `postgres/`：数据库初始化脚本。
- `waf/`：Coraza + CRS 运行资产。
- `nginx/`：反向代理入口层配置占位。

## 边界
- 该目录只存基础设施资产与配置，不存应用业务代码。

## 对外接口
- 由 `docker-compose.yml` 和运维脚本引用。
- PostgreSQL 初始化通过 `infrastructure/postgres/init/*.sql` 自动执行。
- WAF 配置通过 `infrastructure/waf/runtime/main.conf` 作为入口。

## 关键入口/函数
- 配置板块，无业务函数。入口由 docker 与运行配置文件决定。
