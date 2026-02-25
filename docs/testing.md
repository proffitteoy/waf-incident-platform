# 测试与回放说明

## 目标

在不依赖 HTTP 入口的情况下，验证日志解析、事件关联、风险评估与执行器替换能力。

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
- 目录：`backend/tests/unit/`
- 用例：
  - `correlator.test.js`
  - `policy-engine.test.js`

执行：

```bash
cd backend
npm.cmd test
```

## 约束对齐

- 不进行真实 iptables 或系统级命令调用
- 不启动 mock server
- 逻辑可独立单测
- LLM 调用可 stub
- 执行器可 mock
- 不引入隐式状态
- 执行动作链路以 `actions` 表为事实记录
