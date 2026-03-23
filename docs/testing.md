# 测试与回放说明

## 目标

按“局部逻辑 -> 模块治理 -> 路由集成 -> 业务流程 -> 前端展示”分层验证项目闭环，并保持 `actions` 表为动作事实记录。

## 分层测试目录

- 统一目录：`test/`
- 后端测试：`test/backend/`
- 前端测试：`test/frontend/`

说明：

- 所有可执行测试代码统一放在 `test/` 下。
- 后端与前端配置都从 `test/` 目录加载测试文件。

## 日志回放

- 入口脚本：`backend/replay.js`
- 输入：日志文件路径
- 核心流程：
  1. 逐行读取日志
  2. `parser.parseLine(line)`
  3. 批量写入 `events_raw`
  4. `correlator.process(event)`
  5. 如产出 incident，打印 `id/severity/event_count`

示例：

```bash
cd backend
node replay.js tests/logs/sqli.log
```

## 样本日志

目录：`backend/tests/logs/`

- `normal.log`：正常访问
- `sqli.log`：SQL 注入（rule `942100`）
- `xss.log`：XSS（rule `941100`）
- `scan.log`：高频 404
- `brute.log`：同 IP 高频请求

## 单元测试

- 框架：Jest
- 目录：`test/backend/unit/`
- 用例：
  - `correlator.test.js`
  - `policy-engine.test.js`

执行：

```bash
cd backend
npm.cmd test
```

## 新增分层测试

- 后端运行器：`backend/jest.config.cjs`
- 前端运行器：`frontend/vite.config.js` 中的 `vitest` 配置

执行：

```bash
cd backend
npm.cmd run test:unit
npm.cmd run test:module
npm.cmd run test:integration
npm.cmd run test:workflow
```

```bash
cd frontends
npm.cmd test
```

## 发布门禁建议

- 必须通过后端构建与全部分层测试。
- 必须通过前端构建与组件测试。
- LLM 仅允许在测试中 stub，上线路径仍以真实调用链路为准。
- 执行器可以 mock，但动作闭环必须验证 `actions` 表写入与 Redis 状态写入/清理。

## 约束对齐

- 不进行真实 iptables 或系统级命令调用
- 不启动 mock server
- 逻辑可独立单测
- LLM 调用可 stub
- 执行器可 mock
- 不引入隐式状态
- 执行动作链路以 `actions` 表为事实记录
