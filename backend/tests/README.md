# backend/tests 板块说明

## 板块内容

- `logs/`：日志回放样本
  - `normal.log`
  - `sqli.log`
  - `xss.log`
  - `scan.log`
  - `brute.log`
- `unit/`：Jest 单元测试
  - `correlator.test.js`
  - `policy-engine.test.js`

## 边界

- 仅包含可独立执行的测试数据与测试代码。
- 不依赖 HTTP 服务，不创建 mock 服务器。
- 单元测试以内存结构验证逻辑，不访问数据库。

## 对外接口

- 运行全部单测：`npm.cmd test`
- 指定测试文件：`npx jest tests/unit/correlator.test.js`
- 回放样本日志：`node replay.js tests/logs/sqli.log`

## 关键测试覆盖

- 同 IP + 同 rule 聚合为单一 incident
- 单条低分事件不产生 incident
- 高频 404 升级为 `medium`
- 多 rule 命中升级为 `high`
- 风险评估阈值：
  - `score_sum > 10` -> `high`
  - `score_sum 5-10` -> `medium`
  - `score_sum < 5` -> `low`
