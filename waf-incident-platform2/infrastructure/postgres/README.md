# infrastructure/postgres 板块说明

## 板块内容
- `init/`：数据库建表、索引、种子数据脚本。

## 边界
- 只维护数据库 schema 与初始数据，不放业务 SQL 查询代码。

## 对外接口
- Docker 启动 PostgreSQL 时自动执行 `init/*.sql`。

## 关键入口/函数
- 配置板块，无业务函数。入口为 init/*.sql 自动执行机制。
