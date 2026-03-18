-- WAF 事件平台数据库表结构

-- 资产表
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 原始事件表
CREATE TABLE events_raw (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMP NOT NULL,
    asset_id UUID REFERENCES assets(id),
    src_ip INET,
    method VARCHAR(10),
    uri TEXT,
    status INTEGER,
    waf_engine VARCHAR(50),
    rule_id VARCHAR(50),
    rule_msg TEXT,
    rule_score INTEGER,
    waf_action VARCHAR(50),
    tags JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'raw',
    incident_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 告警表
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL,
    event_id UUID NOT NULL,
    alert_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 事件单表
CREATE TABLE incidents (
    incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id),
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(20),
    status VARCHAR(50) DEFAULT 'open',
    src_ip INET,
    summary TEXT,
    metadata JSONB,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 动作表
CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES incidents(incident_id),
    action_type VARCHAR(50),
    scope VARCHAR(50),
    target TEXT,
    ttl_seconds INTEGER,
    requested_by VARCHAR(100),
    executed_by VARCHAR(100),
    result VARCHAR(50),
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 审批表
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES incidents(incident_id),
    action_plan JSONB,
    risk_level VARCHAR(20),
    status VARCHAR(50) DEFAULT 'pending',
    requested_by VARCHAR(100),
    justification TEXT,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- LLM 报告表
CREATE TABLE llm_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES incidents(incident_id),
    model VARCHAR(100),
    task VARCHAR(100),
    prompt_version VARCHAR(50),
    prompt_digest VARCHAR(64),
    input_digest VARCHAR(64),
    attack_chain JSONB,
    key_iocs JSONB,
    risk_assessment JSONB,
    recommended_actions_low JSONB,
    recommended_actions_high JSONB,
    confidence DECIMAL(5,4),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 审计日志表
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id UUID,
    actor VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_events_raw_incident_id ON events_raw(incident_id);
CREATE INDEX idx_events_raw_src_ip ON events_raw(src_ip);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_actions_incident_id ON actions(incident_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_llm_reports_incident_id ON llm_reports(incident_id);