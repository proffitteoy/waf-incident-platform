import geoip from "geoip-lite";
import { query } from "../../core/db/pool";
import { logger } from "../../core/logger";

export const lookupCountry = (ip: string): string | null => {
  try {
    const geo = geoip.lookup(ip);
    return geo?.country ?? null;
  } catch {
    return null;
  }
};

let cachedBlockedCountries: Set<string> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

export const isIpGeoBlocked = async (
  ip: string
): Promise<{ blocked: boolean; country: string | null }> => {
  if (!ip) return { blocked: false, country: null };

  const country = lookupCountry(ip);
  if (!country) return { blocked: false, country: null };

  const now = Date.now();
  if (!cachedBlockedCountries || now > cacheExpiresAt) {
    try {
      const result = await query<{ country_codes: string[] }>(
        `SELECT country_codes FROM geo_block_rules WHERE is_active = true`
      );
      const allCodes = result.rows.flatMap((row) => row.country_codes);
      cachedBlockedCountries = new Set(allCodes);
    } catch (err) {
      logger.warn("geo block cache load failed", { error: err instanceof Error ? err.message : String(err) });
      cachedBlockedCountries = cachedBlockedCountries ?? new Set();
    }
    cacheExpiresAt = now + CACHE_TTL_MS;
  }

  return { blocked: cachedBlockedCountries.has(country), country };
};

export const invalidateGeoBlockCache = (): void => {
  cachedBlockedCountries = null;
  cacheExpiresAt = 0;
};
