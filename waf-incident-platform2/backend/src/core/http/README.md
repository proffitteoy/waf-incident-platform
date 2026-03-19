# backend/src/core/http 板块说明

## 板块内容
- `async-handler.ts`：异步路由统一错误传递。
- `http-error.ts`：结构化业务错误类型。
- `error-handler.ts`：404 与全局异常处理中间件。
- `query-utils.ts`：`range/limit/offset` 解析与校验。

## 边界
- 只处理 HTTP 通用行为，不处理业务判定。

## 对外接口
- `asyncHandler()`
- `HttpError`
- `notFoundHandler`、`errorHandler`
- `parseRangeToHours()`、`parseLimit()`、`parseOffset()`
