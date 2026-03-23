# infrastructure/postgres/init 板块说明

## 板块内容
- `001_schema.sql`：MVP 全量 schema。
- `002_llm_prompt_governance.sql`：为 `llm_reports` 补充 `task/prompt_version/prompt_digest` 字段。
- `003_system_settings.sql`：新增 `system_settings` 表，用于持久化系统级配置（含 LLM 配置）。

## 边界
- 只允许声明结构与初始化数据，避免耦合应用运行时逻辑。

## 对外接口
- 创建表：`assets`、`events_raw`、`alerts`、`incidents`、`actions`、`approvals`、`forensics`、`policies`、`llm_reports`、`users`、`audit_logs`。
- 建立索引与默认策略/用户种子。
- 为 `llm_reports` 提供 Prompt 治理相关字段。
- 提供 `system_settings` 配置持久化存储。

## 关键入口/函数
- 配置板块，无代码函数。核心入口文件：`001_schema.sql`、`002_llm_prompt_governance.sql`。
