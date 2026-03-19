-- WAF 事件平台 PostgreSQL 初始化表结构

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  entrypoint TEXT,
  environment TEXT NOT NULL DEFAULT 'prod',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events_raw (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  src_ip INET,
  method TEXT,
  uri TEXT,
  status INTEGER,
  bytes BIGINT,
  ua TEXT,
  referer TEXT,
  waf_engine TEXT,
  rule_id TEXT,
  rule_msg TEXT,
  rule_score INTEGER NOT NULL DEFAULT 0,
  waf_action TEXT,
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'med', 'high')),
  status TEXT NOT NULL CHECK (status IN ('open', 'mitigating', 'resolved')),
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  src_ip INET,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'med', 'high')),
  status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'closed')),
  score INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 1,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  action_draft JSONB NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'med', 'high')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  approval_id UUID REFERENCES approvals(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('rate_limit', 'block', 'challenge', 'rollback')),
  scope TEXT NOT NULL CHECK (scope IN ('ip', 'uri', 'global')),
  target TEXT NOT NULL,
  ttl_seconds INTEGER,
  requested_by TEXT,
  executed_by TEXT,
  result TEXT NOT NULL CHECK (result IN ('pending', 'success', 'fail')),
  detail TEXT,
  rollback_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS action_receipts (
  id BIGSERIAL PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('apply', 'rollback')),
  status TEXT NOT NULL CHECK (status IN ('success', 'fail', 'timeout', 'skipped')),
  observed_status INTEGER,
  reason TEXT,
  probe_mode TEXT NOT NULL DEFAULT 'gateway_probe',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forensics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  ts_start TIMESTAMPTZ NOT NULL,
  ts_end TIMESTAMPTZ NOT NULL,
  filter TEXT,
  pcap_uri TEXT,
  sha256 CHAR(64),
  size_bytes BIGINT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'capturing', 'completed', 'failed')) DEFAULT 'queued',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  risk_threshold_low INTEGER NOT NULL,
  risk_threshold_high INTEGER NOT NULL,
  low_risk_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  high_risk_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_ttl_seconds INTEGER NOT NULL DEFAULT 1800,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  model TEXT,
  task TEXT,
  prompt_version TEXT,
  prompt_digest TEXT,
  input_digest TEXT,
  attack_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_iocs JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_actions_low JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions_high JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('analyst', 'approver', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_raw_ts ON events_raw(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_raw_src_ip ON events_raw(src_ip);
CREATE INDEX IF NOT EXISTS idx_events_raw_rule_id ON events_raw(rule_id);
CREATE INDEX IF NOT EXISTS idx_events_raw_asset_id ON events_raw(asset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status_severity ON incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_actions_incident_id ON actions(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_result_created ON actions(result, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_receipts_action_id ON action_receipts(action_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forensics_incident_id ON forensics(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_reports_incident_id ON llm_reports(incident_id, created_at DESC);

INSERT INTO policies (name, risk_threshold_low, risk_threshold_high, low_risk_actions, high_risk_actions, default_ttl_seconds, is_active, version)
VALUES (
  'default-policy',
  20,
  60,
  '["rate_limit", "challenge"]'::jsonb,
  '["block"]'::jsonb,
  1800,
  TRUE,
  1
)
ON CONFLICT DO NOTHING;

INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2b$10$wJ3wJt39z8CCvM6bpPAcLeYfhl9fNSmTa1z6u8hQ7E35rdyA8n4TO', 'admin')
ON CONFLICT (username) DO NOTHING;
