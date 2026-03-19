function parseLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 7) {
    throw new Error(`invalid replay log format: ${trimmed}`);
  }

  const tsRaw = tokens[0];
  const ip = tokens[1];
  const method = tokens[2];
  const statusRaw = tokens[tokens.length - 3];
  const ruleIdRaw = tokens[tokens.length - 2];
  const scoreRaw = tokens[tokens.length - 1];
  const uri = tokens.slice(3, tokens.length - 3).join(" ");

  if (!uri) {
    throw new Error(`invalid replay log format: ${trimmed}`);
  }

  const ts = new Date(tsRaw);
  if (Number.isNaN(ts.getTime())) {
    throw new Error(`invalid timestamp: ${tsRaw}`);
  }

  const status = Number.parseInt(statusRaw, 10);
  if (Number.isNaN(status)) {
    throw new Error(`invalid status code: ${statusRaw}`);
  }

  const score = Number.parseInt(scoreRaw, 10);
  if (Number.isNaN(score)) {
    throw new Error(`invalid score: ${scoreRaw}`);
  }

  const ruleId = ruleIdRaw === "-" ? null : ruleIdRaw;

  return {
    ts: ts.toISOString(),
    src_ip: ip,
    method,
    uri,
    status,
    rule_id: ruleId,
    rule_score: score,
    rule_msg: ruleId ? `replayed rule ${ruleId}` : null,
    waf_engine: "replay",
    waf_action: ruleId ? "deny" : "pass",
    tags: {
      source: "replay_log"
    }
  };
}

module.exports = {
  parseLine
};
