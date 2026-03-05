import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import DashboardPage from "../../../frontend/src/pages/DashboardPage.vue";

const flushPromises = async () => {
  await Promise.resolve();
  await nextTick();
};

describe("DashboardPage", () => {
  test("loads overview data from the backend API and renders live metrics", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range_hours: 24,
        summary: {
          request_count: 128,
          waf_hits: 34,
          blocked_count: 12
        },
        action_stats: {
          action_success: 9,
          action_total: 10
        },
        top_attack_sources: [],
        top_target_uris: [],
        top_rules: []
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(DashboardPage);
    await vi.waitFor(async () => {
      await flushPromises();
      expect(wrapper.text()).toContain("128");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/overview?range=24h", {
      headers: {
        "Content-Type": "application/json"
      }
    });
    expect(wrapper.text()).toContain("34");
    expect(wrapper.text()).toContain("12");
    expect(wrapper.text()).toContain("9");
    expect(wrapper.text()).toContain("Live metrics sourced from the backend overview API.");
  });

  test("falls back to placeholder cards when the API request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503
      })
    );

    const wrapper = mount(DashboardPage);
    await flushPromises();

    expect(wrapper.text()).toContain("Failed to load dashboard data");
    expect(wrapper.text()).toContain("-");
  });
});
