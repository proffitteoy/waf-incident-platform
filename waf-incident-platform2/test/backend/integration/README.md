# test/backend/integration 目录说明

## 板块内容
- 路由集成测试。

## 边界
- 通过 `supertest(app)` 调用后端路由。
- 使用测试替身注入数据库与缓存依赖。

## 运行方式
- `cd backend && npm.cmd run test:integration`
