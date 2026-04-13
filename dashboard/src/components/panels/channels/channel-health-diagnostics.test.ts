import { describe, expect, it } from "vitest";
import type { ChannelAccount } from "@/stores/channels";
import { getAccountHealthDiagnostic } from "./channel-health-diagnostics";

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

describe("getAccountHealthDiagnostic", () => {
  it("prefers configuration guidance when account is not configured", () => {
    const result = getAccountHealthDiagnostic(makeAccount({ configured: false }));
    expect(result.titleKey).toBe("configIncompleteTitle");
    expect(result.nextStepKey).toBe("configIncompleteNextStep");
  });

  it("explains linked but disconnected accounts", () => {
    const result = getAccountHealthDiagnostic(makeAccount({ linked: true, connected: false }));
    expect(result.titleKey).toBe("linkedDisconnectedTitle");
  });

  it("treats enabled but unlinked accounts as login/relink candidates", () => {
    const result = getAccountHealthDiagnostic(makeAccount({ linked: false, connected: false }));
    expect(result.titleKey).toBe("enabledNotLinkedTitle");
  });

  it("marks fully linked and connected accounts as healthy", () => {
    const result = getAccountHealthDiagnostic(makeAccount({ linked: true, connected: true }));
    expect(result.titleKey).toBe("healthyTitle");
  });
});
