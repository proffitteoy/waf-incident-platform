const { evaluateRisk } = require("../../tools/policy-engine");

describe("evaluateRisk", () => {
  test("score_sum > 10 -> high", () => {
    const result = evaluateRisk({ score_sum: 11 });

    expect(result).toEqual({
      risk_level: "high",
      recommended_actions_low: expect.any(Array),
      recommended_actions_high: expect.any(Array)
    });
  });

  test("score_sum 5-10 -> medium", () => {
    const result = evaluateRisk({ score_sum: 7 });

    expect(result).toEqual({
      risk_level: "medium",
      recommended_actions_low: expect.any(Array),
      recommended_actions_high: expect.any(Array)
    });
  });

  test("score_sum < 5 -> low", () => {
    const result = evaluateRisk({ score_sum: 3 });

    expect(result).toEqual({
      risk_level: "low",
      recommended_actions_low: expect.any(Array),
      recommended_actions_high: expect.any(Array)
    });
  });
});
