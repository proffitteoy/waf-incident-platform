# services 板块说明

## 板块内容
- `forensics-worker/`：抓包工作进程（Python）。

## 边界
- `services/` 目录用于独立进程，不放主后端路由逻辑。

## 对外接口
- 当前 worker 通过任务参数驱动，后续可扩展为消息队列消费模式。

## 关键函数/入口
- 当前独立服务入口：orensics-worker/src/capture.py。
