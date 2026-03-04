# frontend/src/pages 板块说明

## 板块内容
- `DashboardPage.vue`：首页仪表盘页面。

## 边界
- 页面层负责编排组件、触发页面级数据加载和展示状态。

## 对外接口
- `DashboardPage.vue`

## 关键函数
- 通过 `apiGet()` 拉取 `/api/dashboard/overview`。
- 基于卡片数据渲染 `OverviewPanel` 组件列表。
