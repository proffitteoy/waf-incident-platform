# MCP Tools 契约（web-test）

## 文档目的

声明 web-test 当前是否暴露 MCP 工具。

## 适用范围/边界

- 当前项目定位为 WAF 联调网站，不承载 MCP 网关。

## 当前实现状态（2026-03-05）

- 当前不提供 `GET /api/mcp/tools` 与 `POST /api/mcp/invoke`。
- 当前不定义 MCP 工具清单。

## 变更影响

- 若后续新增 MCP 网关，必须同步新增：
  - 工具名
  - 参数
  - 错误语义
  - 副作用说明
