import { Pool } from "pg";
import { logger } from "./logger";

const pool = new Pool({
  host: process.env.PG_HOST || "127.0.0.1",
  port: parseInt(process.env.PG_PORT || "5432", 10),
  database: process.env.PG_DATABASE || "waf_incident",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "postgres",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

export const query = async (text: string, params?: unknown[]) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error("[database] 查询失败:", error);
    throw error;
  }
};

export const getClient = async () => {
  return await pool.connect();
};

pool.on('error', (err) => {
  logger.error('[Database] 数据库连接池错误', { error: err.message });
});

export async function connectDatabase() {
  try {
    await pool.query('SELECT 1');
    logger.info('[Database] 连接成功');
  } catch (error) {
    logger.error('[Database] 连接失败', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export { pool };