import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
  LOG_ARCHIVE_DIR: z.string().default("./storage/logs"),
  PCAP_DIR: z.string().default("./storage/pcap"),
  REPORT_DIR: z.string().default("./storage/reports"),
  TSHARK_BIN: z.string().default("tshark"),
  DEFAULT_CAPTURE_WINDOW_MINUTES: z.coerce.number().int().default(5)
});

export const env = envSchema.parse(process.env);
