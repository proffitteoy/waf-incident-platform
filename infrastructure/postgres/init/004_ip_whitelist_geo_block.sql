-- IP 白名单策略表：指定 IP/CIDR 范围的可信来源，ingestion 时跳过事件存储
CREATE TABLE IF NOT EXISTS ip_whitelist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cidr TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 地区封禁策略表：指定需封禁的国家/地区代码列表
CREATE TABLE IF NOT EXISTS geo_block_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_codes TEXT[] NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_is_active ON ip_whitelist_entries(is_active);
CREATE INDEX IF NOT EXISTS idx_geo_block_is_active ON geo_block_rules(is_active);
