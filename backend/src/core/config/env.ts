import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanFromEnv = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) {
        return true;
      }

      if (value === 0) {
        return false;
      }

      throw new Error("expected 0 or 1 for boolean env value");
    }

    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }

    throw new Error(`invalid boolean env value: ${value}`);
  });

const envSchema = z.object({
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().default(5432),
  POSTGRES_DB: z.string().default("waf_incident"),
  POSTGRES_USER: z.string().default("waf_user"),
  POSTGRES_PASSWORD: z.string().default("waf_password"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_KEY_PREFIX: z.string().default("waf:mvp"),
  BACKEND_PORT: z.coerce.number().int().default(3000),
  JWT_SECRET: z.string().default("replace-this-secret"),
  LLM_API_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("waf-mvp-analyzer"),
  LLM_MODEL_VERSION: z.string().default("default"),
  LLM_TASK_NAME: z.string().default("waf_incident_analysis_mvp"),
  LLM_PROMPT_VERSION: z.string().default("v1"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  LLM_RETRY_BACKOFF_MS: z.coerce.number().int().positive().default(250),
  LLM_CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(3),
  LLM_CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().int().positive().default(30000),
  LLM_FALLBACK_MODE: z.enum(["disabled", "deterministic"]).default("deterministic"),
  AUTO_ANALYZE_ON_INGEST: booleanFromEnv.default(true),
  AUTO_ANALYZE_ACTOR: z.string().min(1).default("ingestion-auto"),
  ACTION_VERIFY_ENABLED: booleanFromEnv.default(true),
  WAF_PROBE_BASE_URL: z.string().url().default("http://waf"),
  WAF_PROBE_DEFAULT_PATH: z.string().min(1).default("/"),
  ACTION_VERIFY_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  ACTION_VERIFY_RATE_LIMIT_BURST: z.coerce.number().int().min(1).max(200).default(35),
  ACTION_VERIFY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  ACTION_VERIFY_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  ACTION_VERIFY_WATCHDOG_ENABLED: booleanFromEnv.default(true),
  ACTION_VERIFY_WATCHDOG_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  ACTION_VERIFY_PENDING_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  ACTION_VERIFY_WATCHDOG_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(200),
  LOG_ARCHIVE_DIR: z.string().default("./storage/logs"),
  PCAP_DIR: z.string().default("./storage/pcap"),
  REPORT_DIR: z.string().default("./storage/reports"),
  TSHARK_BIN: z.string().default("tshark"),
  DEFAULT_CAPTURE_WINDOW_MINUTES: z.coerce.number().int().default(5),
  BACKEND_API_URL: z.string().url().default("http://localhost:3000"),
  FORENSICS_PYTHON_BIN: z.string().default("python3"),
  FORENSICS_DOWNLOAD_TOKEN_REQUIRED: booleanFromEnv.default(false),
  FORENSICS_DOWNLOAD_SIGNING_SECRET: z.string().min(16).default("change-this-forensics-secret"),
  FORENSICS_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300)
});

export const env = envSchema.parse(process.env);
