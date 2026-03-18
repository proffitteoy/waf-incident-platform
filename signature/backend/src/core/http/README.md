# signature/backend/src/core/http 板块说明

## 板块内容
- `async-handler.ts`：异步请求处理器，统一捕获 Promise 异常。
- `http-error.ts`：HTTP 错误类，携带状态码与错误码。

## 边界
- 仅提供 HTTP 层基础设施，不包含业务逻辑。
- 被路由层依赖，用于统一异常处理。

## 对外接口
- `asyncHandler(fn)`：包装异步路由处理函数。
- `HttpError(statusCode, message, code)`：抛出 HTTP 错误。

## 关键函数/入口
- `asyncHandler`：Express 中间件包装器。
- `HttpError`：标准化错误类。