export interface LlmEventInput {
  id: number;
  ts: string;
  asset_id: string | null;
  src_ip: string | null;
  method: string | null;
  uri: string | null;
  status: number | null;
  rule_id: string | null;
  rule_msg: string | null;
  rule_score: number | null;
  waf_action: string | null;
}

export interface AnalyzeIncidentInput {
  requested_by: string;
  asset_id: string | null;
  src_ip: string | null;
  events: LlmEventInput[];
}
