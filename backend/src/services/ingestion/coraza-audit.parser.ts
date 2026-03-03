import { z } from "zod";
import { HttpError } from "../../core/http/http-error";
import { SecurityEvent } from "../../models/security-event";

const detailsSchema = z
  .object({
    ruleId: z.union([z.string(), z.number()]).optional(),
    message: z.string().optional(),
    data: z.string().optional(),
    severity: z.union([z.string(), z.number()]).optional(),
    tags: z.array(z.string()).optional()
  })
  .passthrough();

const messageSchema = z
  .object({
    message: z.string().optional(),
    details: detailsSchema.optional()
  })
  .passthrough();

const transactionSchema = z
  .object({
    time_stamp: z.string().optional(),
    timestamp: z.string().optional(),
    client_ip: z.string().optional(),
    request: z
      .object({
        method: z.string().optional(),
        uri: z.string().optional()
      })
      .optional(),
    response: z
      .object({
        http_code: z.union([z.number(), z.string()]).optional()
      })
      .optional(),
    producer: z
      .object({
        modsecurity: z.string().optional(),
        engine: z.string().optional()
      })
      .optional(),
    messages: z.array(messageSchema).optional(),
    interruption: z
      .object({
        action: z.string().optional(),
        status: z.union([z.number(), z.string()]).optional()
      })
      .optional()
  })
  .passthrough();

const envelopeSchema = z
  .object({
    transaction: transactionSchema
  })
  .passthrough();

const parseScore = (data: string | undefined): number => {
  if (!data) {
    return 0;
  }

  const direct = data.match(/(?:anomaly|score)[^0-9]{0,20}(\d{1,3})/i);
  if (direct) {
    return Number.parseInt(direct[1], 10);
  }

  const numeric = data.match(/\d{1,3}/);
  if (numeric) {
    return Number.parseInt(numeric[0], 10);
  }

  return 0;
};

const normalizeTimestamp = (value: string | undefined): string => {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

export const parseCorazaAuditJsonLine = (line: string): SecurityEvent[] => {
  let payload: unknown;

  try {
    payload = JSON.parse(line);
  } catch {
    throw new HttpError(400, "invalid JSON audit line");
  }

  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, "audit line does not match Coraza JSON shape");
  }

  const tx = parsed.data.transaction;
  const ts = normalizeTimestamp(tx.time_stamp ?? tx.timestamp);
  const method = tx.request?.method;
  const uri = tx.request?.uri;
  const status = tx.response?.http_code ? Number(tx.response.http_code) : undefined;
  const srcIp = tx.client_ip;
  const wafEngine = tx.producer?.engine ?? tx.producer?.modsecurity ?? "coraza";
  const wafAction = tx.interruption?.action;

  const messages = tx.messages ?? [];

  if (messages.length === 0) {
    return [
      {
        ts,
        src_ip: srcIp,
        method,
        uri,
        status,
        waf_engine: wafEngine,
        waf_action: wafAction,
        tags: { source: "coraza_audit", has_messages: false }
      }
    ];
  }

  return messages.map((message) => {
    const details = message.details;
    const ruleId = details?.ruleId;

    return {
      ts,
      src_ip: srcIp,
      method,
      uri,
      status,
      waf_engine: wafEngine,
      rule_id: ruleId !== undefined ? String(ruleId) : undefined,
      rule_msg: details?.message ?? message.message,
      rule_score: parseScore(details?.data),
      waf_action: wafAction,
      tags: {
        source: "coraza_audit",
        severity: details?.severity,
        detail_data: details?.data,
        detail_tags: details?.tags ?? []
      }
    } satisfies SecurityEvent;
  });
};
