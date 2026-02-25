#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const parser = require("./tools/parser");
const { createCorrelator } = require("./tools/correlator");

dotenv.config({ path: path.resolve(__dirname, ".env") });

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const BATCH_SIZE = 200;

const insertBatch = async (client, events) => {
  if (events.length === 0) {
    return;
  }

  const values = [];
  const params = [];

  events.forEach((event, index) => {
    const base = index * 12;
    values.push(
      `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12})`
    );

    params.push(
      event.ts,
      null,
      event.src_ip,
      event.method,
      event.uri,
      event.status,
      event.waf_engine,
      event.rule_id,
      event.rule_msg,
      event.rule_score,
      event.waf_action,
      JSON.stringify(event.tags ?? {})
    );
  });

  const sql = `
    INSERT INTO events_raw (
      ts, asset_id, src_ip, method, uri, status,
      waf_engine, rule_id, rule_msg, rule_score, waf_action, tags
    ) VALUES ${values.join(",")}
  `;

  await client.query(sql, params);
};

const parseLogFile = async (logFilePath) => {
  const stream = fs.createReadStream(logFilePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const correlator = createCorrelator();
  const events = [];

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const event = parser.parseLine(line);
    if (!event) {
      continue;
    }

    events.push(event);

    const incident = correlator.process(event);
    if (incident) {
      console.log(`incident id=${incident.id} severity=${incident.severity} event_count=${incident.event_count}`);
    }
  }

  return events;
};

const main = async () => {
  const logFileArg = process.argv[2];

  if (!logFileArg) {
    console.error("Usage: node replay.js <log-file-path>");
    process.exit(1);
  }

  const logFilePath = path.resolve(process.cwd(), logFileArg);
  if (!fs.existsSync(logFilePath)) {
    console.error(`log file not found: ${logFilePath}`);
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
    database: process.env.POSTGRES_DB ?? "waf_incident",
    user: process.env.POSTGRES_USER ?? "waf_user",
    password: process.env.POSTGRES_PASSWORD ?? "waf_password"
  });

  const client = await pool.connect();

  try {
    const events = await parseLogFile(logFilePath);

    await client.query("BEGIN");

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const chunk = events.slice(i, i + BATCH_SIZE);
      await insertBatch(client, chunk);
    }

    await client.query("COMMIT");

    console.log(`replay complete, inserted events: ${events.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("replay failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

void main();
