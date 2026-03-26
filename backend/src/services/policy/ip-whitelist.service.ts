import { query } from "../../core/db/pool";
import { logger } from "../../core/logger";

const ipToNum = (ip: string): number => {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, octet) => (acc << 8) | (parseInt(octet, 10) & 0xff), 0) >>> 0;
};

export const cidrContainsIp = (cidr: string, ip: string): boolean => {
  try {
    const slashIdx = cidr.indexOf("/");
    const network = slashIdx === -1 ? cidr : cidr.slice(0, slashIdx);
    const prefix = slashIdx === -1 ? 32 : parseInt(cidr.slice(slashIdx + 1), 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
    const mask = prefix === 0 ? 0 : ((~0 << (32 - prefix)) >>> 0);
    return (ipToNum(ip) & mask) === (ipToNum(network) & mask);
  } catch {
    return false;
  }
};

let cachedCidrs: string[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

export const isIpWhitelisted = async (ip: string): Promise<boolean> => {
  if (!ip) return false;

  const now = Date.now();
  if (!cachedCidrs || now > cacheExpiresAt) {
    try {
      const result = await query<{ cidr: string }>(
        `SELECT cidr FROM ip_whitelist_entries WHERE is_active = true`
      );
      cachedCidrs = result.rows.map((row) => row.cidr);
    } catch (err) {
      logger.warn("ip whitelist cache load failed", { error: err instanceof Error ? err.message : String(err) });
      cachedCidrs = cachedCidrs ?? [];
    }
    cacheExpiresAt = now + CACHE_TTL_MS;
  }

  return cachedCidrs.some((cidr) => cidrContainsIp(cidr, ip));
};

export const invalidateWhitelistCache = (): void => {
  cachedCidrs = null;
  cacheExpiresAt = 0;
};
