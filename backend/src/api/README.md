# backend/src/api 板块说明

## 板块内容
- `router.ts`：统一挂载所有业务路由。
- `routes/*.routes.ts`：各业务域的路由实现。
- 动作执行闭环：执行下发、网关生效确认、状态查询与时间线查询。

## 边界
- 只做参数校验、调用服务、组织响应。
- 不在该层写复杂解析算法或底层连接逻辑。

## 对外接口
- 统一前缀：`/api`。
- 路由聚合入口：`apiRouter`。
- 动作执行状态语义：`requested / dispatched / effective / expired / rolled_back / failed`。
- 取证下载语义：`/forensics/:fid/download` 签发短时下载地址，`/forensics/:fid/file` 返回文件流。

## 关键函数
- `router.ts`：`apiRouter.use(...)` 进行模块装配。
- 各路由文件：`xxxRouter` 导出供聚合层挂载。
