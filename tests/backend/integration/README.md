# tests/backend/integration 板块说明

## 板块内容
- 面向路由的集成测试。

## 边界
- 通过 `supertest(app)` 调用应用。
- 数据层与 Redis 通过测试替身受控注入。

## 对外接口
- 由 `npm.cmd run test:integration` 执行。
