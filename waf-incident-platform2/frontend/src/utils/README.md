# frontend/src/utils 板块说明

## 板块内容
- `api-client.ts`：前端统一 GET 请求函数。

## 边界
- 仅做最小请求封装，不包含业务数据转换。

## 对外接口
- `apiGet<T>(path)`

## 关键函数
- 请求失败时抛出 `Error`，由上层页面处理。
