/* eslint-disable no-console -- 日志模块统一使用控制台输出 */

export const logger = {
  info: (message: string, meta?: unknown) => console.log("[INFO]", message, meta ?? ""),
  warn: (message: string, meta?: unknown) => console.warn("[WARN]", message, meta ?? ""),
  error: (message: string, meta?: unknown) => console.error("[ERROR]", message, meta ?? "")
};
