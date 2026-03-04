# tests 板块说明

## 板块内容
- 存放测试分层说明与测试目录索引。
- 可执行测试代码位于各自 package 内的 `tests-layered/` 目录。

## 边界
- 仅放测试索引说明和分层 README。
- 不承载生产逻辑，也不直接参与测试运行。

## 对外接口
- 后端入口：`backend/jest.config.cjs`
- 前端入口：`frontend/vite.config.js` 中的 `test` 配置

## 关键目录
- `backend/tests-layered/`
- `frontend/tests-layered/`
