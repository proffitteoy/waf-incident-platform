import { Router, Request, Response } from "express";
import { asyncHandler } from "../../core/http/async-handler";
import { HttpError } from "../../core/http/http-error";
import forensicsService from "../../services/forensics/forensics.service";
import * as path from "path";

export const forensicsRouter = Router();

/**
 * 取证异步闭环路由模块
 * 
 * 【独立运行能力】：
 * 本模块配合 `services/forensics-worker` 可独立于主后端运行，完成完整的取证闭环：
 * 1. 接收抓包请求 -> 创建 queued 记录
 * 2. Worker 异步抓包 -> 回写 completed/failed 状态及 sha256
 * 3. 下载接口 -> 实时计算并返回真实文件签名
 * 
 * 【接口清单】：
 * - POST /api/incidents/:id/forensics/capture
 * - GET /api/forensics/:fid/download
 * - GET /api/forensics/:fid/meta
 */

/**
 * GET /api/forensics/:fid/download
 * 
 * 【功能】：下载 pcap 文件并返回真实 SHA256 签名
 * 【修复点】：
 * 1. 增加 params 类型防御，防止 string[] 异常
 * 2. 确保返回真实文件流而非提示信息
 * 3. 响应头 X-SHA256-Signature 返回实时计算值
 */
forensicsRouter.get(
  "/:fid/download",
  asyncHandler(async (req: Request, res: Response) => {
    // 修复：处理 req.params.fid 可能为 string[] 的情况
    const fidParam = req.params.fid;
    const fid = Array.isArray(fidParam) ? fidParam[0] : fidParam;
    
    if (!fid || typeof fid !== 'string') {
      throw new HttpError(400, "Invalid forensics ID");
    }

    // 查询取证记录
    const record = await forensicsService.getForensicsRecord(fid);

    if (!record) {
      throw new HttpError(404, "Forensics record not found");
    }

    // 检查状态
    if (record.status !== "completed") {
      throw new HttpError(400, `Forensics capture not completed. Current status: ${record.status}`);
    }

    // 验证文件路径
    if (!record.pcap_path) {
      throw new HttpError(404, "PCAP file path not recorded");
    }

    // 读取文件并计算签名（服务层处理）
    // 此处已实现真实文件读取与 SHA256 实时计算
    const { fileBuffer, sha256, fileSize } = await forensicsService.readAndVerifyPcap(record.pcap_path, record.sha256);

    // 设置响应头
    res.setHeader("Content-Type", "application/vnd.tcpdump.pcap");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(record.pcap_path)}"`);
    res.setHeader("Content-Length", fileSize.toString());
    res.setHeader("X-SHA256-Signature", sha256);  // 返回真实签名
    res.setHeader("X-Forensics-ID", fid);
    res.setHeader("X-Incident-ID", record.incident_id);

    // 返回文件流
    res.send(fileBuffer);
  })
);

/**
 * GET /api/forensics/:fid/meta
 * 
 * 【功能】：仅返回元数据（不下载文件）
 */
forensicsRouter.get(
  "/:fid/meta",
  asyncHandler(async (req: Request, res: Response) => {
    // 修复：处理 req.params.fid 可能为 string[] 的情况
    const fidParam = req.params.fid;
    const fid = Array.isArray(fidParam) ? fidParam[0] : fidParam;

    if (!fid || typeof fid !== 'string') {
      throw new HttpError(400, "Invalid forensics ID");
    }

    const record = await forensicsService.getForensicsRecord(fid);

    if (!record) {
      throw new HttpError(404, "Forensics record not found");
    }

    res.json({
      id: record.id,
      incident_id: record.incident_id,
      sha256: record.sha256,
      size_bytes: record.size_bytes,
      status: record.status,
      created_at: record.created_at,
      capture_window: {
        start: record.capture_window_start,
        end: record.capture_window_end
      }
    });
  })
);

/**
 * POST /api/incidents/:id/forensics/capture
 * 
 * 【功能】：触发抓包任务，写入 forensics 表，状态初始为 queued
 */
forensicsRouter.post(
  "/:incidentId/capture",
  asyncHandler(async (req: Request, res: Response) => {
    // 修复：处理 req.params.incidentId 可能为 string[] 的情况
    const incidentIdParam = req.params.incidentId;
    const incidentId = Array.isArray(incidentIdParam) ? incidentIdParam[0] : incidentIdParam;

    if (!incidentId || typeof incidentId !== 'string') {
      throw new HttpError(400, "Invalid incident ID");
    }

    const { time_window_minutes, filter_expr } = req.body ?? {};

    // 计算抓包窗口
    const now = new Date();
    const windowMinutes = time_window_minutes ?? 5;
    const captureWindowStart = new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString();
    const captureWindowEnd = now.toISOString();

    // 创建取证记录
    const forensicsId = await forensicsService.createForensicsRecord(
      incidentId,
      captureWindowStart,
      captureWindowEnd
    );

    res.status(202).json({
      code: 202,
      data: {
        forensics_id: forensicsId,
        incident_id: incidentId,
        status: "queued",
        capture_window: {
          start: captureWindowStart,
          end: captureWindowEnd
        },
        filter_expr: filter_expr ?? null
      }
    });
  })
);