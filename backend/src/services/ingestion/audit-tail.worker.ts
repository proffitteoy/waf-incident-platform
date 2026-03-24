import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createInterface } from "node:readline";

const LOG_FILE_PATH = process.env.WAF_AUDIT_LOG_PATH ?? "/app/storage/logs/waf-audit.log";
const OFFSET_FILE_PATH = process.env.WAF_AUDIT_OFFSET_PATH ?? "/app/storage/logs/waf-audit.offset";
const INGEST_URL = process.env.INGESTION_API_URL ?? `${process.env.BACKEND_API_URL ?? "http://backend:3000"}/api/ingestion/coraza/audit-lines`;
const POLL_INTERVAL_MS = Number.parseInt(process.env.INGESTION_POLL_INTERVAL_MS ?? "2000", 10);
const BATCH_LINES = Number.parseInt(process.env.INGESTION_BATCH_LINES ?? "50", 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.INGESTION_REQUEST_TIMEOUT_MS ?? "10000", 10);
const RETRY_MAX = Number.parseInt(process.env.INGESTION_RETRY_MAX ?? "3", 10);

type ScanResult = {
  lines: string[];
  nextOffset: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const loadOffset = (): number => {
  try {
    if (!existsSync(OFFSET_FILE_PATH)) {
      return 0;
    }

    const raw = readFileSync(OFFSET_FILE_PATH, "utf8").trim();
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
};

const saveOffset = (offset: number): void => {
  writeFileSync(OFFSET_FILE_PATH, String(offset), "utf8");
};

const scanNewLines = async (offset: number): Promise<ScanResult> => {
  if (!existsSync(LOG_FILE_PATH)) {
    return { lines: [], nextOffset: offset };
  }

  const stat = statSync(LOG_FILE_PATH);
  const fileSize = stat.size;

  if (fileSize <= offset) {
    const safeOffset = Math.max(0, fileSize);
    return { lines: [], nextOffset: safeOffset };
  }

  const stream = createReadStream(LOG_FILE_PATH, {
    encoding: "utf8",
    start: offset,
    end: fileSize - 1
  });

  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const lines: string[] = [];

  for await (const raw of rl) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    lines.push(line);
  }

  return { lines, nextOffset: fileSize };
};

const toCompressedPayload = (lines: string[]): string => {
  const body = `${lines.join("\n")}\n`;
  return gzipSync(Buffer.from(body, "utf8")).toString("base64");
};

const postBatch = async (lines: string[]): Promise<void> => {
  const payload = {
    lines_gzip_base64: toCompressedPayload(lines)
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ingestion http ${res.status}: ${text}`);
    }
  } finally {
    clearTimeout(timer);
  }
};

const ingestWithRetry = async (lines: string[]): Promise<void> => {
  for (let attempt = 1; attempt <= RETRY_MAX; attempt += 1) {
    try {
      await postBatch(lines);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ingestion-worker] batch failed (attempt ${attempt}/${RETRY_MAX}): ${message}`);
      if (attempt === RETRY_MAX) {
        throw error;
      }
      await sleep(500 * attempt);
    }
  }
};

const ingestAll = async (lines: string[]): Promise<void> => {
  for (let i = 0; i < lines.length; i += BATCH_LINES) {
    const chunk = lines.slice(i, i + BATCH_LINES);
    await ingestWithRetry(chunk);
  }
};

const run = async (): Promise<void> => {
  console.log(`[ingestion-worker] started`);
  console.log(`[ingestion-worker] log file: ${LOG_FILE_PATH}`);
  console.log(`[ingestion-worker] offset file: ${OFFSET_FILE_PATH}`);
  console.log(`[ingestion-worker] ingestion api: ${INGEST_URL}`);

  let currentOffset = loadOffset();
  let busy = false;

  setInterval(async () => {
    if (busy) {
      return;
    }
    busy = true;

    try {
      const { lines, nextOffset } = await scanNewLines(currentOffset);
      if (lines.length === 0) {
        if (nextOffset !== currentOffset) {
          currentOffset = nextOffset;
          saveOffset(currentOffset);
        }
        return;
      }

      await ingestAll(lines);
      currentOffset = nextOffset;
      saveOffset(currentOffset);
      console.log(`[ingestion-worker] ingested ${lines.length} lines, offset=${currentOffset}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ingestion-worker] tick failed: ${message}`);
    } finally {
      busy = false;
    }
  }, POLL_INTERVAL_MS);
};

void run();
