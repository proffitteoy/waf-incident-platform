# test 目录说明

## 目录目标
- 统一存放项目所有可执行测试代码。
- 按后端与前端分组，按测试层级细分。

## 目录结构
- `test/backend/unit/`
- `test/backend/module/`
- `test/backend/integration/`
- `test/backend/workflow/`
- `test/frontend/component/`

## 运行入口
- 后端：`backend/jest.config.cjs`
- 前端：`frontend/vite.config.js` 的 `test` 配置
