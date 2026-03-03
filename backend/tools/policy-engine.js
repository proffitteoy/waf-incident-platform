function evaluateRisk(incident = {}) {
  const scoreSum = Number(incident.score_sum ?? 0);

  let riskLevel = "low";
  if (scoreSum > 10) {
    riskLevel = "high";
  } else if (scoreSum >= 5) {
    riskLevel = "medium";
  }

  return {
    risk_level: riskLevel,
    recommended_actions_low: ["observe", "collect_evidence"],
    recommended_actions_high: ["block_ip_temp", "rate_limit", "manual_review"]
  };
}

module.exports = {
  evaluateRisk
};
