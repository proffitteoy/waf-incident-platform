# 文档中心（web-test/docs）

本目录是 `web-test` 子项目的唯一文档维护入口，作为开发、联调、验收契约。

## 文档分层

1. **治理与约束**
- `强前置条件约束.md`：开发红线与胶水约束。
- `文档规范.md`：文档结构与同步规则。

2. **目标与架构**
- `技术细节.md`：当前目标、实现状态、核心流程。
- `architecture.md`：当前落地架构与模块边界。
- `canvas-dev/project.canvas`：中文架构白板主文件。

3. **接口契约**
- `api-spec.md`：REST 接口与攻击场景契约。
- `mcp-tools.md`：MCP 状态说明（当前不启用）。

4. **运行与测试**
- `testing.md`：接口测试与攻击回放方式。
- `waf-integration.md`：WAF/CRS 对接方式。

## 维护规则

- 路由/参数变化后，必须同步 `api-spec.md` 与 `技术细节.md`。
- 架构节点或依赖变化后，必须同步 `architecture.md` 与 `canvas-dev/project.canvas`。
- 攻击场景变化后，必须同步 `testing.md` 与 `waf-integration.md`。
- 文档路径全部使用仓库相对路径。
