import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  // PostgreSQL
  POSTGRES_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/waf_incident"),
  
  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379/0"),
  
  // Backend
  BACKEND_PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // Storage
  PCAP_STORAGE_DIR: z.string().default("./storage/pcap"),
  
  // Forensics
  TSHARK_BIN: z.string().default("tshark")
});

export const env = envSchema.parse(process.env);