import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../chat";

describe("A2UI store actions", () => {
  beforeEach(() => {
    useChatStore.setState({ sessions: new Map(), activeSessionKey: null, sessionMeta: [] });
    useChatStore.getState().ensureSession("s1");
  });

  it("appendA2UIEvent adds event to log", () => {
    useChatStore.getState().appendA2UIEvent("s1", {
      timestamp: 1,
      direction: "inbound",
      action: "surfaceUpdate",
      summary: "test",
      raw: {},
    });
    const log = useChatStore.getState().sessions.get("s1")?.a2uiState?.eventLog;
    expect(log).toHaveLength(1);
    expect(log![0].action).toBe("surfaceUpdate");
  });

  it("appendA2UIEvent respects ring buffer limit", () => {
    for (let i = 0; i < 210; i++) {
      useChatStore.getState().appendA2UIEvent("s1", {
        timestamp: i,
        direction: "inbound",
        action: "test",
        summary: `e${i}`,
        raw: {},
      });
    }
    const log = useChatStore.getState().sessions.get("s1")?.a2uiState?.eventLog;
    expect(log).toHaveLength(200);
    expect(log![0].summary).toBe("e10");
  });

  it("updateA2UIBridgeStatus sets status", () => {
    useChatStore.getState().updateA2UIBridgeStatus("s1", "ready");
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState?.bridgeStatus).toBe("ready");
  });

  it("updateA2UISurfaces sets surfaces list", () => {
    useChatStore.getState().updateA2UISurfaces("s1", ["main", "overlay"]);
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState?.surfaces).toEqual([
      "main",
      "overlay",
    ]);
  });

  it("setA2UIState merges instead of replacing", () => {
    // First set some state
    useChatStore.getState().appendA2UIEvent("s1", {
      timestamp: 1,
      direction: "inbound",
      action: "test",
      summary: "e1",
      raw: {},
    });
    // Now merge in url+visible — eventLog should survive
    useChatStore.getState().setA2UIState("s1", { url: "http://test", visible: true });
    const state = useChatStore.getState().sessions.get("s1")?.a2uiState;
    expect(state?.url).toBe("http://test");
    expect(state?.visible).toBe(true);
    expect(state?.eventLog).toHaveLength(1);
  });

  it("setA2UIState with null clears state", () => {
    useChatStore.getState().setA2UIState("s1", { url: "http://test", visible: true });
    useChatStore.getState().setA2UIState("s1", null);
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState).toBeNull();
  });
});
