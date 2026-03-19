# Backend 板块说明

## 板块内容

- API 与路由编排：`src/api`
- 核心基础设施：`src/core`
- 业务服务：`src/services`
- 回放与测试工具：`replay.js`、`tools/*`、`tests/*`

## 边界

- 负责 API 编排、业务闭环、落库与缓存状态。
- 不直接实现 Nginx/Coraza 引擎。
- 执行器在 MVP 使用可替换实现（测试阶段使用 mock）。

## 对外接口

- REST：`/health`、`/api/*`
- MCP：`/api/mcp/tools`、`/api/mcp/invoke`

## 关键入口与函数

- `src/server.ts`：`bootstrap()`
- `src/core/db/pool.ts`：`query()`
- `src/core/cache/redis.ts`：`connectRedis()`、`setRedisJson()`、`delRedisKey()`
- `src/services/llm/incident-analyzer.ts`：`analyzeIncidentWithLlmApi()`
- `src/services/llm/llmService.stub.ts`：`generateIncidentReport()`
- `replay.js`：日志回放入口（逐行解析、批量入库、事件关联输出）
- `tools/parser.js`：`parseLine(line)`
- `tools/correlator.js`：`createCorrelator().process(event)`
- `tools/policy-engine.js`：`evaluateRisk(incident)`

## 启动与测试

1. 复制环境变量：`copy .env.example .env`
2. 安装依赖：`npm.cmd install`
3. 启动开发服务：`npm.cmd run dev`
4. 编译检查：`npm.cmd run build`
5. 运行单测：`npm.cmd test`
6. 日志回放：`node replay.js tests/logs/normal.log`

## 子板块文档

- `src/README.md`
- `src/api/README.md`
- `src/api/routes/README.md`
- `src/core/README.md`
- `src/services/README.md`
- `tests/README.md`
