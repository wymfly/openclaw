import { beforeEach, describe, expect, it, vi } from "vitest";

let useChatStore: typeof import("@/stores/chat").useChatStore;

beforeEach(async () => {
  vi.resetModules();
  ({ useChatStore } = await import("@/stores/chat"));
});

describe("SLC-3: setStreaming clears activeApproval", () => {
  it("clears activeApproval when streaming is set to false", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setActiveApproval("sess-1", {
      id: "approval-1",
      toolName: "bash",
      command: "rm -rf /tmp/test",
    });
    store.setStreaming("sess-1", true, "run-1");

    expect(useChatStore.getState().sessions.get("sess-1")?.activeApproval).not.toBeNull();

    store.setStreaming("sess-1", false);
    expect(useChatStore.getState().sessions.get("sess-1")?.activeApproval).toBeNull();
  });

  it("does not clear activeApproval when streaming is set to true", () => {
    const store = useChatStore.getState();
    store.ensureSession("sess-1");
    store.setActiveApproval("sess-1", {
      id: "approval-1",
      toolName: "bash",
      command: "echo hi",
    });

    store.setStreaming("sess-1", true, "run-2");
    expect(useChatStore.getState().sessions.get("sess-1")?.activeApproval).toEqual({
      id: "approval-1",
      toolName: "bash",
      command: "echo hi",
    });
  });
});
