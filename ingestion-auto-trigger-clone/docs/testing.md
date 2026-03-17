# 测试与回放说明

## 目标

按"局部逻辑 -> 模块治理 -> 路由集成 -> 业务流程 -> 前端展示"分层验证项目闭环，并保持 `actions` 表为动作事实记录。

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
