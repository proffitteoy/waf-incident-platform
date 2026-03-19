/**
 * 安全事件标准化接口
 * 用于统一 ingestion 层与数据库交互的数据结构
 */
export interface SecurityEvent {
  ts: string;          // 时间戳 (ISO 8601)
  asset_id?: string;   // 资产 ID (可选)
  src_ip?: string;     // 源 IP 地址
  method?: string;     // HTTP 方法 (GET/POST 等)
  uri?: string;        // 请求路径
  status?: number;     // 响应状态码
  waf_engine?: string; // WAF 引擎名称
  rule_id?: string;    // 触发规则 ID
  rule_msg?: string;   // 规则消息
  rule_score?: number; // 规则评分
  waf_action?: string; // WAF 动作 (allow/block)
  tags?: Record<string, unknown>; // 额外标签
}