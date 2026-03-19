const { evaluateRisk } = require("./policy-engine");

function createCorrelator(options = {}) {
  const minSameRuleEvents = Number(options.minSameRuleEvents ?? 3);
  const minScan404Events = Number(options.minScan404Events ?? 5);

  const buckets = new Map();
  let incidentSeq = 0;

  const getOrCreateBucket = (event) => {
    const key = `ip:${event.src_ip}`;
    if (buckets.has(key)) {
      return { key, bucket: buckets.get(key) };
    }

    const bucket = {
      events: [],
      uniqueRules: new Set(),
      ruleCounts: new Map(),
      scoreSum: 0,
      status404Count: 0,
      emitted: false
    };

    buckets.set(key, bucket);
    return { key, bucket };
  };

  const process = (event) => {
    const { key, bucket } = getOrCreateBucket(event);

    bucket.events.push(event);
    bucket.scoreSum += Number(event.rule_score ?? 0);

    if (event.status === 404) {
      bucket.status404Count += 1;
    }

    if (event.rule_id) {
      bucket.uniqueRules.add(event.rule_id);
      const currentRuleCount = bucket.ruleCounts.get(event.rule_id) ?? 0;
      bucket.ruleCounts.set(event.rule_id, currentRuleCount + 1);
    }

    if (bucket.emitted) {
      return null;
    }

    const sameRuleTriggered = [...bucket.ruleCounts.values()].some((count) => count >= minSameRuleEvents);
    const scanTriggered = bucket.status404Count >= minScan404Events;
    const multiRuleTriggered = bucket.uniqueRules.size >= 2;

    if (!sameRuleTriggered && !scanTriggered && !multiRuleTriggered) {
      return null;
    }

    const risk = evaluateRisk({ score_sum: bucket.scoreSum });
    let severity = risk.risk_level;

    if (scanTriggered && severity === "low") {
      severity = "medium";
    }

    if (multiRuleTriggered) {
      severity = "high";
    }

    bucket.emitted = true;
    incidentSeq += 1;

    return {
      id: `incident-${incidentSeq}`,
      severity,
      event_count: bucket.events.length,
      score_sum: bucket.scoreSum,
      rule_ids: [...bucket.uniqueRules],
      source_key: key
    };
  };

  const reset = () => {
    buckets.clear();
    incidentSeq = 0;
  };

  return {
    process,
    reset,
    getState: () => buckets
  };
}

module.exports = {
  createCorrelator
};
