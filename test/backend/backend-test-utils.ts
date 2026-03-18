import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { DataType, newDb } from "pg-mem";

interface QueryResultRow {
  [column: string]: unknown;
}

interface QueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number | null;
}

type QueryFn = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<QueryResult<T>>;

interface RedisEntry {
  value: unknown;
  ttl_seconds: number | null;
}

interface CreateTestAppOptions {
  llmAnalyzeImplementation?: () => Promise<unknown>;
  surface?: "llm-reports" | "workflow" | "ingestion";
  envOverrides?: Record<string, string>;
}

export interface TestAppContext {
  app: any;
  query: QueryFn;
  close: () => Promise<void>;
  redisStore: Map<string, RedisEntry>;
  seedEventRaw: (overrides?: Partial<SeedEventInput>) => Promise<number>;
  seedIncident: (overrides?: Partial<SeedIncidentInput>) => Promise<{ id: string }>;
}

interface SeedEventInput {
  ts: string;
  asset_id: string | null;
  src_ip: string | null;
  method: string | null;
  uri: string | null;
  status: number | null;
  waf_engine: string;
  rule_id: string | null;
  rule_msg: string | null;
  rule_score: number;
  waf_action: string | null;
  tags: Record<string, unknown>;
}

interface SeedIncidentInput {
  asset_id: string | null;
  title: string;
  severity: "low" | "med" | "high";
  status: "open" | "mitigating" | "resolved";
  first_seen: string;
  last_seen: string;
  src_ip: string | null;
  summary: string;
}

const schemaPath = path.resolve(__dirname, "../../infrastructure/postgres/init/001_schema.sql");
const schemaSql = readFileSync(schemaPath, "utf8");

const defaultLlmAnalyzeImplementation = async () => {
  return {
    analysis: {
      title: "SQLi from 203.0.113.10",
      summary: "Correlated SQL injection attempts.",
      severity: "high",
      attack_chain: [{ stage: "recon", detail: "Repeated WAF rule hits." }],
      key_iocs: [{ type: "src_ip", value: "203.0.113.10" }],
      risk_assessment: { summary: "Active attack", rationale: "High score events" },
      recommended_actions_low: ["review timeline"],
      recommended_actions_high: ["request approval for temporary block"],
      confidence: 91
    },
    meta: {
      provider: "llm_api",
      fallback_mode: "disabled",
      degraded: false,
      task: "waf_incident_analysis_mvp",
      prompt_version: "v1",
      prompt_digest: "prompt-digest",
      model: "mock-model",
      model_version: "2026-03-04",
      report_model: "mock-model@2026-03-04#v1",
      input_digest: "input-digest",
      attempts: 1,
      retries: 0,
      latency_ms: 12,
      circuit_state: "closed",
      failure_reason: null
    }
  };
};

const normalizeRow = <T extends QueryResultRow>(row: T): T => {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }

      return [key, value];
    })
  );

  return normalized as T;
};

const adaptQueryForPgMem = (text: string, params: unknown[] = []) => {
  let sql = text
    .replace(/ts::text/gi, "ts")
    .replace(/first_seen::text/gi, "first_seen")
    .replace(/last_seen::text/gi, "last_seen")
    .replace(/created_at::text/gi, "created_at")
    .replace(/updated_at::text/gi, "updated_at")
    .replace(/reviewed_at::text/gi, "reviewed_at")
    .replace(/completed_at::text/gi, "completed_at");
  const values = [...params];

  if (/INSERT INTO actions\s*\(/i.test(sql) && !/,\s*id\s*\)/i.test(sql)) {
    sql = sql.replace(/executed_at\s*\)/i, "executed_at, id)");
    sql = sql.replace(/NOW\(\)/i, `NOW(), $${values.length + 1}`);
    values.push(randomUUID());
  }

  return { sql, values };
};

const registerPgcrypto = (db: ReturnType<typeof newDb>) => {
  db.registerExtension("pgcrypto", (schema: any) => {
    schema.registerFunction({
      name: "gen_random_uuid",
      args: [],
      returns: DataType.uuid,
      implementation: () => randomUUID()
    });
  });
};

export const createTestApp = async (options: CreateTestAppOptions = {}): Promise<TestAppContext> => {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  registerPgcrypto(db);
  db.public.none(schemaSql);

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  const query: QueryFn = (text, params = []) => {
    const adapted = adaptQueryForPgMem(text, params);
    return pool.query(adapted.sql, adapted.values as never[]).then((result: QueryResult) => ({
      ...result,
      rows: result.rows.map((row) => normalizeRow(row))
    }));
  };

  const redisStore = new Map<string, RedisEntry>();

  jest.resetModules();
  const envBackup = { ...process.env };

  if (options.envOverrides) {
    for (const [key, value] of Object.entries(options.envOverrides)) {
      process.env[key] = value;
    }
  }

  const dbPoolModule = require.resolve("../../backend/src/core/db/pool");
  const cacheModule = require.resolve("../../backend/src/core/cache/redis");
  const llmAnalyzerModule = require.resolve("../../backend/src/services/llm/incident-analyzer");
  const errorHandlerModule = require.resolve("../../backend/src/core/http/error-handler");
  const approvalsModule = require.resolve("../../backend/src/api/routes/approvals.routes");
  const actionsModule = require.resolve("../../backend/src/api/routes/actions.routes");
  const llmReportsModule = require.resolve("../../backend/src/api/routes/llm-reports.routes");
  const ingestionModule = require.resolve("../../backend/src/api/routes/ingestion.routes");

  jest.doMock(dbPoolModule, () => ({
    pool: {
      connect: async () => {
        const client = await pool.connect();

        return {
          query: (text: string, params: unknown[] = []) => {
            const adapted = adaptQueryForPgMem(text, params);
            return client.query(adapted.sql, adapted.values as never[]).then((result: QueryResult) => ({
              ...result,
              rows: result.rows.map((row) => normalizeRow(row))
            }));
          },
          release: () => client.release()
        };
      }
    },
    query
  }));

  jest.doMock(cacheModule, () => ({
    buildRedisKey: (...segments: string[]) => ["waf:test", ...segments].join(":"),
    setRedisJson: async (key: string, value: unknown, ttlSeconds?: number) => {
      redisStore.set(key, { value, ttl_seconds: ttlSeconds ?? null });
    },
    delRedisKey: async (key: string) => {
      return redisStore.delete(key) ? 1 : 0;
    },
    getRedisHealth: () => ({
      connected: true,
      open: true,
      host: "test",
      port: 6379,
      db: 0
    }),
    connectRedis: async () => {},
    closeRedis: async () => {}
  }));

  jest.doMock(llmAnalyzerModule, () => ({
    analyzeIncidentWithLlmApi: options.llmAnalyzeImplementation ?? defaultLlmAnalyzeImplementation
  }));

  let app: any;

  jest.isolateModules(() => {
    const express = require("express");
    const { errorHandler, notFoundHandler } = require(errorHandlerModule);

    app = express();
    app.use(express.json());

    if (options.surface === "workflow") {
      const { approvalsRouter } = require(approvalsModule);
      const { actionsRouter } = require(actionsModule);

      app.use("/api/approvals", approvalsRouter);
      app.use("/api", actionsRouter);
    } else if (options.surface === "ingestion") {
      const { ingestionRouter } = require(ingestionModule);

      app.use("/api", ingestionRouter);
    } else {
      const { llmReportsRouter } = require(llmReportsModule);

      app.use("/api/incidents", llmReportsRouter);
    }

    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  const seedEventRaw = async (overrides: Partial<SeedEventInput> = {}) => {
    const input: SeedEventInput = {
      ts: "2026-03-04T00:00:00.000Z",
      asset_id: null,
      src_ip: "203.0.113.10",
      method: "GET",
      uri: "/login",
      status: 403,
      waf_engine: "coraza",
      rule_id: "942100",
      rule_msg: "SQL Injection Attack Detected",
      rule_score: 8,
      waf_action: "deny",
      tags: {},
      ...overrides
    };

    const result = await query<{ id: number }>(
      `INSERT INTO events_raw (
         ts, asset_id, src_ip, method, uri, status,
         waf_engine, rule_id, rule_msg, rule_score, waf_action, tags
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        input.ts,
        input.asset_id,
        input.src_ip,
        input.method,
        input.uri,
        input.status,
        input.waf_engine,
        input.rule_id,
        input.rule_msg,
        input.rule_score,
        input.waf_action,
        JSON.stringify(input.tags)
      ]
    );

    return result.rows[0].id;
  };

  const seedIncident = async (overrides: Partial<SeedIncidentInput> = {}) => {
    const input: SeedIncidentInput = {
      asset_id: null,
      title: "Suspicious traffic from 203.0.113.10",
      severity: "high",
      status: "open",
      first_seen: "2026-03-04T00:00:00.000Z",
      last_seen: "2026-03-04T00:05:00.000Z",
      src_ip: "203.0.113.10",
      summary: "Seed incident",
      ...overrides
    };

    const result = await query<{ id: string }>(
      `INSERT INTO incidents (asset_id, title, severity, status, first_seen, last_seen, src_ip, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id::text`,
      [
        input.asset_id,
        input.title,
        input.severity,
        input.status,
        input.first_seen,
        input.last_seen,
        input.src_ip,
        input.summary
      ]
    );

    return result.rows[0];
  };

  return {
    app,
    query,
    close: async () => {
      await pool.end();
      for (const key of Object.keys(process.env)) {
        if (!(key in envBackup)) {
          delete process.env[key];
        }
      }

      for (const [key, value] of Object.entries(envBackup)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
    redisStore,
    seedEventRaw,
    seedIncident
  };
};
