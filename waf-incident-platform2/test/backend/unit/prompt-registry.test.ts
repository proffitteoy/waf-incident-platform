import { renderPrompt } from "../../../backend/src/services/llm/prompt-registry";

describe("renderPrompt", () => {
  test("renders prompt content and stable digest from the input contract", () => {
    const input = {
      requested_by: "tester",
      asset_id: null,
      src_ip: "203.0.113.10",
      events: [
        {
          id: 1,
          ts: "2026-03-04T00:00:00.000Z",
          asset_id: null,
          src_ip: "203.0.113.10",
          method: "GET",
          uri: "/login",
          status: 403,
          rule_id: "942100",
          rule_msg: "SQL Injection Attack Detected",
          rule_score: 8,
          waf_action: "deny"
        }
      ]
    };

    const rendered = renderPrompt("waf_incident_analysis_mvp", "v1", input);

    expect(rendered.task).toBe("waf_incident_analysis_mvp");
    expect(rendered.version).toBe("v1");
    expect(rendered.prompt).toContain("src_ip=203.0.113.10");
    expect(rendered.prompt).toContain("rule_id=942100");
    expect(rendered.prompt_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("throws when the prompt definition does not exist", () => {
    expect(() => {
      renderPrompt("unknown_task", "v9", {
        requested_by: "tester",
        asset_id: null,
        src_ip: null,
        events: []
      });
    }).toThrow("prompt not found");
  });
});
