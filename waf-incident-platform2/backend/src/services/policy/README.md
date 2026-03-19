# backend/src/services/policy 板块说明

## 板块内容
- `action-state.ts`：动作状态的 Redis 键构造、写入与清理。

## 边界
- 仅维护动作缓存状态，不替代 `actions` 数据库事实表。

## 对外接口
- `buildActiveActionKey(scope, actionType, target)`
- `cacheActiveActionState(input)`
- `clearActiveActionState(params)`

## 关键函数
- `encodeTarget()`：将目标值编码为 Redis 键安全片段。
