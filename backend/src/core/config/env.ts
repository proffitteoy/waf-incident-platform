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
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  LOG_ARCHIVE_DIR: z.string().default("./storage/logs"),
  PCAP_DIR: z.string().default("./storage/pcap"),
  REPORT_DIR: z.string().default("./storage/reports"),
  TSHARK_BIN: z.string().default("tshark"),
  DEFAULT_CAPTURE_WINDOW_MINUTES: z.coerce.number().int().default(5)
});

export const env = envSchema.parse(process.env);
