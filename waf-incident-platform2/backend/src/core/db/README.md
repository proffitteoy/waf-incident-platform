# backend/src/core/db 板块说明

## 板块内容
- `pool.ts`：PostgreSQL 连接池与统一查询函数。

## 边界
- 只负责数据库连接和 SQL 执行，不封装业务语义。

## 对外接口
- `pool`：连接池实例。
- `query<T>()`：泛型查询函数。

## 关键函数
- `query<T>(text, params)`：执行参数化 SQL 并返回结果。
