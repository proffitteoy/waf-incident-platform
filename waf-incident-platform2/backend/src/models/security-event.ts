export type Severity = "low" | "med" | "high";
export type IncidentStatus = "open" | "mitigating" | "resolved";

export interface SecurityEvent {
  ts: string;
  asset_id?: string;
  src_ip?: string;
  method?: string;
  uri?: string;
  status?: number;
  waf_engine?: string;
  rule_id?: string;
  rule_msg?: string;
  rule_score?: number;
  waf_action?: string;
  tags?: Record<string, unknown>;
}
