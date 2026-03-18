import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";
import { query } from "../../core/db/pool";
import { logger } from "../../core/logger";

export interface ForensicsRecord {
  id: string;
  incident_id: string;
  pcap_path: string | null;
  sha256: string | null;
  size_bytes: number | null;
  status: string;
  created_at: string;
  capture_window_start: string | null;
  capture_window_end: string | null;
}

export interface PcapFileResult {
  fileBuffer: Buffer;
  sha256: string;
  fileSize: number;
}

/**
 * 获取取证记录
 */
export const getForensicsRecord = async (fid: string): Promise<ForensicsRecord | null> => {
  const result = await query(
    `SELECT id, incident_id, pcap_path, sha256, size_bytes, status, created_at, 
            capture_window_start, capture_window_end
     FROM forensics
     WHERE id = $1`,
    [fid]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as ForensicsRecord;
};

/**
 * 读取 PCAP 文件并验证签名
 */
export const readAndVerifyPcap = async (
  pcapPath: string,
  expectedSha256: string | null
): Promise<PcapFileResult> => {
  if (!fs.existsSync(pcapPath)) {
    throw new Error(`PCAP file not found: ${pcapPath}`);
  }

  const fileBuffer = fs.readFileSync(pcapPath);
  const fileSize = fileBuffer.length;
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  if (expectedSha256 && expectedSha256 !== sha256) {
    logger.warn(`Signature mismatch. DB: ${expectedSha256}, Calculated: ${sha256}`);
  }

  return {
    fileBuffer,
    sha256,
    fileSize
  };
};

/**
 * 更新取证记录状态
 */
export const updateForensicsStatus = async (
  fid: string,
  status: string,
  pcapPath?: string,
  sha256?: string,
  sizeBytes?: number
): Promise<void> => {
  const updates: string[] = ["status = $2", "completed_at = NOW()"];
  const params: unknown[] = [fid, status];
  let paramIndex = 3;

  if (pcapPath) {
    updates.push(`pcap_path = $${paramIndex}`);
    params.push(pcapPath);
    paramIndex++;
  }

  if (sha256) {
    updates.push(`sha256 = $${paramIndex}`);
    params.push(sha256);
    paramIndex++;
  }

  if (sizeBytes !== undefined) {
    updates.push(`size_bytes = $${paramIndex}`);
    params.push(sizeBytes);
    paramIndex++;
  }

  await query(
    `UPDATE forensics SET ${updates.join(", ")} WHERE id = $1`,
    params
  );
};

/**
 * 创建取证记录
 */
export const createForensicsRecord = async (
  incidentId: string,
  captureWindowStart: string,
  captureWindowEnd: string
): Promise<string> => {
  const result = await query(
    `INSERT INTO forensics (incident_id, capture_window_start, capture_window_end, status)
     VALUES ($1, $2, $3, 'queued')
     RETURNING id`,
    [incidentId, captureWindowStart, captureWindowEnd]
  );

  return result.rows[0].id;
};

// 聚合导出为默认对象，供路由层使用
const forensicsService = {
  getForensicsRecord,
  readAndVerifyPcap,
  updateForensicsStatus,
  createForensicsRecord
};

export default forensicsService;