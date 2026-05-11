// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  emptyChannelsFixture,
  emptyThroughputFixture,
  probeFailureFixture,
  probeSuccessFixture,
  probeTimeoutFixture,
  telegramDiscordChannelsFixture,
  throughputFixture,
  wecomChannelsFixture,
} from "../__fixtures__/channels.fixture";
import type { ChannelTranslator } from "../types";
import {
  accountDiagnostic,
  applyChannelFilter,
  asRecord,
  booleanValue,
  buildChannelInventory,
  channelMatchesFilter,
  channelProbeLabel,
  channelProbeTone,
  countAlertingAccounts,
  diagnosticClassName,
  displayAccountName,
  formatThroughputSummary,
  hasWecomChannel,
  normalizeChannelAccounts,
  numberValue,
  readThroughputSummary,
  stringValue,
  summarizeInventoryTotals,
  throughputSparkClass,
} from "./channel-selectors";

const t: ChannelTranslator = ((key: string, values?: Record<string, unknown>) => {
  if (!values) {
    return key;
  }
  const formatted = Object.entries(values)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(",");
  return `${key}{${formatted}}`;
}) as ChannelTranslator;
(t as { rich?: unknown }).rich = (key: string) => key;
(t as { raw?: unknown }).raw = (key: string) => key;

describe("primitive readers", () => {
  it("asRecord returns plain object only", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord(null)).toEqual({});
    expect(asRecord([1, 2])).toEqual({});
    expect(asRecord(undefined)).toEqual({});
  });

  it("stringValue/booleanValue/numberValue ignore mismatched types", () => {
    expect(stringValue({ a: "x" }, "a")).toBe("x");
    expect(stringValue({ a: 1 }, "a")).toBe("");
    expect(booleanValue({ a: true }, "a")).toBe(true);
    expect(booleanValue({ a: "true" }, "a")).toBeUndefined();
    expect(numberValue({ a: 1 }, "a")).toBe(1);
    expect(numberValue({ a: NaN }, "a")).toBeUndefined();
    expect(numberValue({ a: "1" }, "a")).toBeUndefined();
  });
});

describe("accountDiagnostic", () => {
  it("returns neutral for explicitly disabled account", () => {
    expect(accountDiagnostic({ enabled: false }, t).tone).toBe("neutral");
  });

  it("returns warning for unconfigured enabled account", () => {
    expect(accountDiagnostic({ enabled: true, configured: false }, t).tone).toBe("warning");
  });

  it("returns error when lastError is present", () => {
    const diagnostic = accountDiagnostic({ enabled: true, configured: true, lastError: "auth" }, t);
    expect(diagnostic.tone).toBe("error");
    expect(diagnostic.description).toBe("auth");
  });

  it("returns warning when linked but disconnected", () => {
    expect(
      accountDiagnostic({ enabled: true, configured: true, linked: true, connected: false }, t)
        .tone,
    ).toBe("warning");
  });

  it("returns warning when enabled but not linked", () => {
    expect(accountDiagnostic({ enabled: true, configured: true, linked: false }, t).tone).toBe(
      "warning",
    );
  });

  it("returns info for opaque payload", () => {
    expect(accountDiagnostic({}, t).tone).toBe("info");
  });

  it("returns success for healthy account", () => {
    expect(
      accountDiagnostic({ enabled: true, configured: true, linked: true, connected: true }, t).tone,
    ).toBe("success");
  });
});

describe("normalizeChannelAccounts and counts", () => {
  it("falls back to index id when accountId is missing on array entries", () => {
    const accounts = normalizeChannelAccounts([{ enabled: true }], t);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].accountId).toBe("1");
  });

  it("preserves accountId from payload and from object key", () => {
    const fromKey = normalizeChannelAccounts({ acct_a: { enabled: true } }, t);
    expect(fromKey[0].accountId).toBe("acct_a");
    const fromPayload = normalizeChannelAccounts([{ accountId: "acct_b", enabled: true }], t);
    expect(fromPayload[0].accountId).toBe("acct_b");
  });

  it("counts alerting accounts using warning/error tones", () => {
    const accounts = normalizeChannelAccounts(
      [
        { accountId: "x", enabled: true, configured: false },
        { accountId: "y", enabled: true, configured: true, linked: true, connected: true },
      ],
      t,
    );
    expect(countAlertingAccounts(accounts)).toBe(1);
  });
});

describe("diagnosticClassName mapping", () => {
  it("maps tones to deck-ui pill class names", () => {
    expect(diagnosticClassName("success")).toBe("is-positive");
    expect(diagnosticClassName("warning")).toBe("is-warning");
    expect(diagnosticClassName("error")).toBe("is-danger");
    expect(diagnosticClassName("info")).toBe("is-info");
    expect(diagnosticClassName("neutral")).toBe("is-muted");
  });
});

describe("channelProbeTone and channelProbeLabel", () => {
  it("classifies probe success", () => {
    expect(channelProbeTone(probeSuccessFixture())).toBe("is-positive");
    expect(channelProbeLabel(probeSuccessFixture(), t)).toBe("probeSuccess");
  });

  it("classifies probe timeout from error message", () => {
    expect(channelProbeTone(probeTimeoutFixture())).toBe("is-warning");
    expect(channelProbeLabel(probeTimeoutFixture(), t)).toBe("probeTimeout");
  });

  it("classifies probe failure as danger", () => {
    expect(channelProbeTone(probeFailureFixture())).toBe("is-danger");
    expect(channelProbeLabel(probeFailureFixture(), t)).toBe("probeFailure");
  });
});

describe("throughput helpers", () => {
  it("readThroughputSummary supports nested throughput shapes", () => {
    expect(readThroughputSummary({ messagesIn: 5, messagesOut: 7 })).toEqual({
      messagesIn: 5,
      messagesOut: 7,
    });
    expect(readThroughputSummary({ throughput: { in: 4, out: 9 } })).toEqual({
      messagesIn: 4,
      messagesOut: 9,
    });
    expect(readThroughputSummary({})).toEqual({ messagesIn: 0, messagesOut: 0 });
  });

  it("formatThroughputSummary returns unavailable for zero traffic", () => {
    expect(formatThroughputSummary({ messagesIn: 0, messagesOut: 0 }, t)).toBe(
      "throughputUnavailable",
    );
    expect(formatThroughputSummary({ messagesIn: 1, messagesOut: 2 }, t)).toBe(
      "throughputInOut{in=1,out=2}",
    );
  });

  it("throughputSparkClass categorizes ratios", () => {
    expect(throughputSparkClass({ messagesIn: 0, messagesOut: 0 }, 100)).toBe("is-zero");
    expect(throughputSparkClass({ messagesIn: 70, messagesOut: 0 }, 100)).toBe("is-high");
    expect(throughputSparkClass({ messagesIn: 35, messagesOut: 0 }, 100)).toBe("is-mid");
    expect(throughputSparkClass({ messagesIn: 5, messagesOut: 0 }, 100)).toBe("is-low");
  });
});

describe("channelMatchesFilter and hasWecomChannel", () => {
  it("matches enabled, alerts, wecom, and all", () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    expect(items.every((item) => channelMatchesFilter(item, "all"))).toBe(true);
    expect(items.filter((item) => channelMatchesFilter(item, "enabled")).length).toBeGreaterThan(0);
    expect(items.filter((item) => channelMatchesFilter(item, "alerts")).length).toBeGreaterThan(0);
    expect(items.filter((item) => channelMatchesFilter(item, "wecom")).length).toBe(0);
    expect(hasWecomChannel(items)).toBe(false);
  });

  it("recognizes wecom channel by id and meta.pluginId", () => {
    const items = buildChannelInventory(wecomChannelsFixture(), t);
    expect(hasWecomChannel(items)).toBe(true);
    expect(channelMatchesFilter(items[0], "wecom")).toBe(true);
  });
});

describe("buildChannelInventory + summarizeInventoryTotals", () => {
  it("normalizes payload into inventory items and totals", () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    expect(items.map((item) => item.id)).toEqual(["telegram", "discord"]);
    expect(items[0].label).toBe("Telegram");
    expect(items[0].defaultAccountId).toBe("acct_tg_main");
    const totals = summarizeInventoryTotals(items);
    expect(totals.totalAccounts).toBe(3);
    expect(totals.alerts).toBeGreaterThan(0);
  });

  it("returns empty inventory and zero totals for empty payload", () => {
    const items = buildChannelInventory(emptyChannelsFixture(), t);
    expect(items).toEqual([]);
    expect(summarizeInventoryTotals(items)).toEqual({
      alerts: 0,
      degraded: 0,
      enabled: 0,
      messagesIn: 0,
      messagesOut: 0,
      totalAccounts: 0,
    });
  });

  it("returns empty inventory for null payload", () => {
    expect(buildChannelInventory(null, t)).toEqual([]);
  });
});

describe("applyChannelFilter (search + filter)", () => {
  it("filters by search query case-insensitively", () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    expect(applyChannelFilter(items, "all", "discord")).toHaveLength(1);
    expect(applyChannelFilter(items, "all", "DISCORD")).toHaveLength(1);
  });

  it("returns empty array for non-matching query", () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    expect(applyChannelFilter(items, "all", "not-a-channel")).toEqual([]);
  });

  it("combines filter and search", () => {
    const items = buildChannelInventory(telegramDiscordChannelsFixture(), t);
    expect(applyChannelFilter(items, "alerts", "telegram")).toEqual([]);
  });
});

describe("displayAccountName", () => {
  it("prefers displayName, falls back to name then accountId", () => {
    const account = normalizeChannelAccounts(
      [{ accountId: "acct_a", displayName: "Display" }],
      t,
    )[0];
    expect(displayAccountName(account)).toBe("Display");
    const named = normalizeChannelAccounts([{ accountId: "acct_b", name: "Named" }], t)[0];
    expect(displayAccountName(named)).toBe("Named");
    const bare = normalizeChannelAccounts([{ accountId: "acct_c" }], t)[0];
    expect(displayAccountName(bare)).toBe("acct_c");
  });
});

describe("throughput fixtures", () => {
  it("throughputFixture returns active buckets and emptyThroughputFixture is empty", () => {
    expect(throughputFixture().buckets?.length).toBe(1);
    expect(emptyThroughputFixture().buckets?.length).toBe(0);
  });
});
