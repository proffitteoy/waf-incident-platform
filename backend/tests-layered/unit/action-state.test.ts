jest.mock("../../src/core/cache/redis", () => ({
  buildRedisKey: (...segments: string[]) => ["waf:test", ...segments].join(":"),
  setRedisJson: jest.fn(async () => {}),
  delRedisKey: jest.fn(async () => 1)
}));

import { delRedisKey, setRedisJson } from "../../src/core/cache/redis";
import {
  buildActiveActionKey,
  cacheActiveActionState,
  clearActiveActionState
} from "../../src/services/policy/action-state";

describe("action-state", () => {
  test("buildActiveActionKey encodes target into a deterministic redis key", () => {
    const key = buildActiveActionKey("ip", "block", "203.0.113.10");

    expect(key).toBe("waf:test:active_action:ip:block:MjAzLjAuMTEzLjEw");
  });

  test("cacheActiveActionState writes ttl-backed payloads", async () => {
    const key = await cacheActiveActionState({
      action_id: "action-1",
      incident_id: "incident-1",
      action_type: "block",
      scope: "ip",
      target: "203.0.113.10",
      ttl_seconds: 1800,
      requested_by: "analyst",
      executed_by: "system"
    });

    expect(key).toBe("waf:test:active_action:ip:block:MjAzLjAuMTEzLjEw");
    expect(setRedisJson).toHaveBeenCalledWith(
      key,
      expect.objectContaining({
        action_id: "action-1",
        incident_id: "incident-1",
        action_type: "block"
      }),
      1800
    );
  });

  test("clearActiveActionState deletes the derived redis key", async () => {
    const result = await clearActiveActionState({
      scope: "ip",
      action_type: "block",
      target: "203.0.113.10"
    });

    expect(result).toEqual({
      key: "waf:test:active_action:ip:block:MjAzLjAuMTEzLjEw",
      deleted: 1
    });
    expect(delRedisKey).toHaveBeenCalledWith("waf:test:active_action:ip:block:MjAzLjAuMTEzLjEw");
  });
});
