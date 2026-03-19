# 文档中心（docs）

本目录是项目文档的唯一维护入口，承接原 `vibe-codeing` 内容并持续演进。

## 文档分层

1. **治理与约束**
- `强前置条件约束.md`：开发与架构红线。
- `通用项目架构模板.md`：目录与分层模板。
- `文档规范.md`：文档维护规则与格式规范。

2. **项目目标与架构**
- `技术细节.md`：MVP 目标、范围、进度、业务流程。
- `architecture.md`：当前实现态架构与模块映射。
- `canvas-dev/project.canvas`：架构白板主文件（中文）。
- `canvas-dev/README.md`：白板文件与提示词使用说明。

3. **接口契约**
- `api-spec.md`：REST API 契约（按代码挂载路径整理）。
- `mcp-tools.md`：MCP 工具契约（工具名、参数、副作用）。

4. **运行与测试**
- `waf-integration.md`：WAF 资产与接线方式。
- `testing.md`：日志回放与测试基建说明。

## 维护规则

- 架构变更后必须同步更新：`技术细节.md`、`architecture.md`、`canvas-dev/project.canvas`。
- 接口变更后必须同步更新：`api-spec.md`、`mcp-tools.md`。
- 任何动作链路变更需明确写清：
  - `actions` 表写入行为。
  - Redis 动作状态键的写入/清理行为。
- 文档路径一律使用项目内相对路径，不写本机绝对路径。

## 迁移说明

- 原 `vibe-codeing/*` 已迁入 `docs/*`。
- 白板主路径已固定为：`docs/canvas-dev/project.canvas`。
