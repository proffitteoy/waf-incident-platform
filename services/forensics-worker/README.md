# Forensics Worker

## 板块内容

- Python 抓包工作进程。
- 轮询 PostgreSQL `forensics` 表，抢占 `queued` 任务执行抓包。
- 根据任务参数调用 `tshark` 输出 `pcap`。
- 计算文件 `sha256` 和大小，供后端回写元数据。

## 边界

- 只负责取证执行。
- 不负责审批、策略判定、事件分析。

## 对外接口

- 输入参数：来自 `forensics` 表记录（`incident_id`、抓包窗口、过滤表达式、输出路径）。
- 输出产物：`pcap` 文件 + 摘要信息（hash/size）+ 状态回写（`capturing/completed/failed`）。

## 关键函数

- `src/capture.py`：抓包执行入口与文件摘要计算。
- `src/worker.py`：任务轮询、抢占、状态推进、审计日志回写。
