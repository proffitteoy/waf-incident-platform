# scripts 板块说明

## 板块内容
- `dev-up.ps1`：启动开发依赖。
- `dev-down.ps1`：停止开发依赖。
- `import-waf-assets.ps1`：导入 Coraza 与 CRS 资产。
- `check-preflight.ps1`：启动前一键自检（Docker、端口、backend/.env 关键项）。

## 边界
- 脚本只做运维编排，不承载业务服务逻辑。

## 对外接口
- PowerShell 命令入口（Windows 开发环境）。

## 关键函数
- `import-waf-assets.ps1`：将外部规则/引擎文件复制到 `infrastructure/waf/runtime`。
- `check-preflight.ps1`：输出 PASS/WARN/FAIL 汇总，定位启动阻塞项。
