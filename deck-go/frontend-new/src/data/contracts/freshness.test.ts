import { describe, expect, it } from "vitest";
import { dataFreshnessTiers, getDataFreshnessPolicy, type DataFreshnessTier } from "./freshness";

describe("Data Fabric freshness policy", () => {
  it("defines all eight named tiers with deterministic options", () => {
    expect(dataFreshnessTiers).toEqual([
      "static",
      "runtime-liveness",
      "config-authority",
      "inventory",
      "live-workbench",
      "historical",
      "lazy-detail",
      "stream-driven",
    ]);

    const policies = Object.fromEntries(
      dataFreshnessTiers.map((tier) => [tier, getDataFreshnessPolicy(tier)]),
    ) as Record<DataFreshnessTier, ReturnType<typeof getDataFreshnessPolicy>>;

    expect(policies.static).toMatchObject({
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    });
    expect(policies["runtime-liveness"]).toMatchObject({
      refetchOnMount: false,
      refetchOnReconnect: "always",
      refetchOnWindowFocus: true,
      staleTime: 10_000,
    });
    expect(policies["stream-driven"]).toMatchObject({
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    });
  });

  it("returns copies so callers cannot mutate shared policy", () => {
    const first = getDataFreshnessPolicy("inventory");
    const second = getDataFreshnessPolicy("inventory");

    first.staleTime = 1;

    expect(second.staleTime).toBe(60_000);
  });
});
