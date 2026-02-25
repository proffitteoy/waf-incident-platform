# 前端仪表盘

## 板块内容

- React + Vite 单页骨架。
- 当前实现总览卡片页面，后续扩展事件单、审批、取证页面。

## 边界

- 仅负责展示与交互。
- 不在前端实现安全策略判定与处置逻辑。

## 对外接口

- API 工具函数：`src/utils/api-client.ts` 的 `apiGet<T>()`。

## 关键函数

- `src/main.tsx`：React 根节点挂载。
- `src/App.tsx`：页面入口。
- `src/pages/DashboardPage.tsx`：仪表盘页面编排。
- `src/components/OverviewPanel.tsx`：指标卡片组件。

## 子板块文档

- `src/README.md`
- `src/components/README.md`
- `src/pages/README.md`
- `src/store/README.md`
- `src/utils/README.md`
