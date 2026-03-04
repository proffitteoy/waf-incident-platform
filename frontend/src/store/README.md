# frontend/src/store 板块说明

## 板块内容
- `dashboard-store.ts`：仪表盘概览响应类型与卡片映射逻辑。

## 边界
- 只负责将核心概览数据映射为页面卡片，不直接发起远程请求。

## 对外接口
- `DashboardCard` 类型。
- `DashboardOverviewResponse` 类型。
- `loadingDashboardCards` 占位数据。
- `buildDashboardCards()`：将后端概览响应转换为卡片列表。
