# tests/backend/workflow 板块说明

## 板块内容
- 端到端业务流程闭环测试。

## 边界
- 覆盖跨多张表与 Redis 状态的主流程。
- 不调用真实执行器或系统级抓包命令。

## 对外接口
- 由 `npm.cmd run test:workflow` 执行。
