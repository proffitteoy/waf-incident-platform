const { createCorrelator } = require("../../tools/correlator");

function createEvent(overrides = {}) {
  return {
    ts: "2026-02-25T00:00:00.000Z",
    src_ip: "203.0.113.10",
    method: "GET",
    uri: "/",
    status: 403,
    rule_id: "942100",
    rule_score: 4,
    ...overrides
  };
}

describe("correlator", () => {
  test("多条相同 IP + 同 rule_id 事件 -> 生成 1 个 incident", () => {
    const correlator = createCorrelator({ minSameRuleEvents: 3 });

    const incidents = [
      correlator.process(createEvent()),
      correlator.process(createEvent()),
      correlator.process(createEvent()),
      correlator.process(createEvent())
    ].filter(Boolean);

    expect(incidents).toHaveLength(1);
    expect(incidents[0].id).toBe("incident-1");
    expect(incidents[0].event_count).toBe(3);
  });

  test("单条低 score 事件 -> 不生成 incident", () => {
    const correlator = createCorrelator();
    const incident = correlator.process(
      createEvent({
        status: 200,
        rule_id: null,
        rule_score: 1
      })
    );

    expect(incident).toBeNull();
  });

  test("高频 404 -> severity=medium", () => {
    const correlator = createCorrelator({ minScan404Events: 5 });
    let incident = null;

    for (let i = 0; i < 5; i += 1) {
      incident = correlator.process(
        createEvent({
          src_ip: "198.51.100.77",
          status: 404,
          rule_id: null,
          rule_score: 0
        })
      );
    }

    expect(incident).not.toBeNull();
    expect(incident.severity).toBe("medium");
  });

  test("多 rule 命中 -> severity=high", () => {
    const correlator = createCorrelator();

    correlator.process(
      createEvent({
        src_ip: "198.51.100.88",
        rule_id: "941100",
        rule_score: 3
      })
    );

    const incident = correlator.process(
      createEvent({
        src_ip: "198.51.100.88",
        rule_id: "942100",
        rule_score: 3
      })
    );

    expect(incident).not.toBeNull();
    expect(incident.severity).toBe("high");
    expect(incident.rule_ids.sort()).toEqual(["941100", "942100"]);
  });
});
