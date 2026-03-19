import { HttpError } from "./http-error";

export const parseRangeToHours = (value: string | undefined): number => {
  if (!value || value === "24h") {
    return 24;
  }

  if (value === "1h") {
    return 1;
  }

  if (value === "7d") {
    return 24 * 7;
  }

  throw new HttpError(400, "invalid range, expected one of: 1h,24h,7d");
};

export const parseLimit = (value: string | undefined, fallback = 50): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 500) {
    throw new HttpError(400, "invalid limit");
  }
  return parsed;
};

export const parseOffset = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new HttpError(400, "invalid offset");
  }
  return parsed;
};
