import { Pool, QueryResult, QueryResultRow } from "pg";
import { env } from "../config/env";

// PostgreSQL 连接池配置
export const pool = new Pool({
  connectionString: env.POSTGRES_URL,
  max: 10,  // 最大连接数
  idleTimeoutMillis: 30000,  // 空闲连接超时
  connectionTimeoutMillis: 2000  // 连接超时
});

/**
 * 执行 SQL 查询
 * 
 * @param text SQL 语句
 * @param params 参数数组
 * @returns 查询结果
 */
export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> => {
  const client = await pool.connect();
  
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
};

/**
 * 关闭连接池
 */
export const closePool = async (): Promise<void> => {
  await pool.end();
};

/**
 * 测试数据库连接
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    await query("SELECT 1");
    return true;
  } catch (error) {
    return false;
  }
};