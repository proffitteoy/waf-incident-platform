import { SecurityEvent } from "../../models/security-event";

export interface RawWafLog {
  ts: string;
  src_ip?: string;
  method?: string;
  uri?: string;
  status?: number;
  rule_id?: string;
  rule_msg?: string;
  rule_score?: number;
  waf_action?: string;
  waf_engine?: string;
}

export const normalizeWafLog = (raw: RawWafLog): SecurityEvent => {
  return {
    ts: raw.ts,
    src_ip: raw.src_ip,
    method: raw.method,
    uri: raw.uri,
    status: raw.status,
    rule_id: raw.rule_id,
    rule_msg: raw.rule_msg,
    rule_score: raw.rule_score ?? 0,
    waf_action: raw.waf_action,
    waf_engine: raw.waf_engine ?? "unknown",
    tags: {}
  };
};
