# canvas-dev 说明

## 目录用途

存放架构白板及其配套提示词，驱动“架构分析 -> 白板生成 -> 编码实现 -> 同步检查”流程。

## 文件说明

- `project.canvas`：架构白板主文件（中文节点与连线）
- `01-架构分析.md`：从代码生成白板的提示词模板
- `02-白板驱动编码.md`：从白板驱动代码实现的提示词模板
- `03-白板同步检查.md`：白板与代码一致性检查模板

## 维护约束

- 白板主维护路径固定为：`docs/canvas-dev/project.canvas`
- 架构变更后，必须同步更新：
  - `docs/architecture.md`
  - `docs/技术细节.md`
  - `docs/canvas-dev/project.canvas`
