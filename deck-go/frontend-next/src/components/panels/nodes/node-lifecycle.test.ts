import { describe, expect, it } from "vitest";
import type { PairingRequest, NodeSummary } from "@/stores/nodes";
import { getNodeLifecycleSummary } from "./node-lifecycle";

function makeNode(partial: Partial<NodeSummary> = {}): NodeSummary {
  return {
    nodeId: "node-1",
    displayName: "Primary Node",
    platform: "ios",
    version: "1.0.0",
    coreVersion: "1.0.0",
    uiVersion: "1.0.0",
    deviceFamily: "phone",
    modelIdentifier: "iphone",
    remoteIp: "127.0.0.1",
    caps: [],
    commands: [],
    paired: false,
    connected: false,
    ...partial,
  };
}

function makeRequest(partial: Partial<PairingRequest> = {}): PairingRequest {
  return {
    requestId: "req-1",
    nodeId: "node-1",
    displayName: "Primary Node",
    platform: "ios",
    ts: Date.now(),
    ...partial,
  };
}

describe("getNodeLifecycleSummary", () => {
  it("prioritizes repair request explanation over generic statuses", () => {
    const result = getNodeLifecycleSummary(
      makeNode({ paired: true, connected: false }),
      makeRequest({ isRepair: true }),
    );

    expect(result.tone).toBe("warning");
    expect(result.titleKey).toBe("lifecycleRepairTitle");
    expect(result.descriptionKey).toBe("lifecycleRepairDescription");
    expect(result.nextStepKey).toBe("lifecycleRepairNextStep");
  });

  it("explains pending pairing before generic unpaired state", () => {
    const result = getNodeLifecycleSummary(makeNode(), makeRequest());

    expect(result.titleKey).toBe("lifecyclePendingTitle");
    expect(result.descriptionKey).toBe("lifecyclePendingDescription");
    expect(result.nextStepKey).toBe("lifecyclePendingNextStep");
  });

  it("treats paired but disconnected nodes as recoverable offline nodes", () => {
    const result = getNodeLifecycleSummary(makeNode({ paired: true, connected: false }), null);

    expect(result.titleKey).toBe("lifecycleOfflineTitle");
    expect(result.descriptionKey).toBe("lifecycleOfflineDescription");
    expect(result.nextStepKey).toBe("lifecycleOfflineNextStep");
  });

  it("treats connected paired nodes as ready", () => {
    const result = getNodeLifecycleSummary(makeNode({ paired: true, connected: true }), null);

    expect(result.tone).toBe("success");
    expect(result.titleKey).toBe("lifecycleConnectedTitle");
    expect(result.descriptionKey).toBe("lifecycleConnectedDescription");
  });
});
