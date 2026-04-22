import { describe, expect, it } from "vitest";
import type { ChannelAccount, ChannelInfo, ProbeResult } from "@/stores/channels";
import {
  countChannelAlerts,
  getAccountHealthAlert,
  hasChannelProbeAlert,
} from "./channel-health-alerts";

function makeAccount(partial: Partial<ChannelAccount> = {}): ChannelAccount {
  return {
    accountId: "acc-1",
    enabled: true,
    configured: true,
    linked: false,
    connected: false,
    ...partial,
  };
}

const failedProbe: ProbeResult = { status: "failure", error: "Auth failed", probedAt: Date.now() };

describe("channel health alerts", () => {
  it("returns null for healthy connected accounts", () => {
    expect(getAccountHealthAlert(makeAccount({ linked: true, connected: true }))).toBeNull();
  });

  it("does not turn channel-level probe failure into an account alert", () => {
    const alert = getAccountHealthAlert(makeAccount({ linked: true, connected: true }));
    expect(alert).toBeNull();
  });

  it("surfaces channel-level probe failure as a summary alert signal", () => {
    expect(hasChannelProbeAlert(failedProbe)).toBe(true);
  });

  it("surfaces channel-level probe timeout as a summary alert signal", () => {
    expect(hasChannelProbeAlert({ status: "timeout", probedAt: Date.now() })).toBe(true);
  });

  it("counts alerting accounts for aggregate summaries", () => {
    const channel: ChannelInfo = {
      id: "telegram",
      label: "Telegram",
      accounts: [
        makeAccount({ accountId: "a1", linked: true, connected: true }),
        makeAccount({ accountId: "a2", lastError: "oops" }),
        makeAccount({ accountId: "a3", configured: false }),
      ],
    };
    expect(countChannelAlerts(channel)).toBe(2);
  });
  it("does not let aggregate channel state create account alerts for healthy accounts", () => {
    const channel: ChannelInfo = {
      id: "telegram",
      label: "Telegram",
      accounts: [makeAccount({ accountId: "a1", linked: true, connected: true })],
    };
    expect(countChannelAlerts(channel)).toBe(0);
  });
});
