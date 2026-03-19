# frontend/src 板块说明

## 板块内容
- `components/`：可复用组件。
- `pages/`：页面容器。
- `store/`：页面数据模型。
- `utils/`：API 访问工具。
- `App.vue`、`main.ts`：应用入口。

## 边界
- 前端只负责展示与交互，不承载后端安全决策。

## 对外接口
- 当前通过 `apiGet()` 访问后端 `/api/*`。

## 关键函数
- `main.ts`：Vue 挂载入口。
- `App.vue`：页面装配入口。
