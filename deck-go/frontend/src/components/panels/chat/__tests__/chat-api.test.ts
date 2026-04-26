import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchChatSnapshot,
  fetchSessionList,
  fetchSessionPreviews,
  resolveInitialSessionSendPlan,
  setSessionMessageSubscription,
} from "../chat-api";

const clearSessionMock = vi.fn();
const createChatSessionMock = vi.fn();
const fetchChatSnapshotRequestMock = vi.fn();
const fetchSessionPreviewsRequestMock = vi.fn();
const fetchSessionsMock = vi.fn();
const patchChatSessionMock = vi.fn();
const patchSessionMock = vi.fn();
const persistChatProjectionMock = vi.fn();
const resolveCanvasEvalMock = vi.fn();
const resetSessionMock = vi.fn();
const sendChatMessageMock = vi.fn();
const setCanvasBridgeReadyMock = vi.fn();
const setSessionEventsSubscriptionMock = vi.fn();
const steerChatSessionMock = vi.fn();
const abortChatRunMock = vi.fn();
const compactChatSessionMock = vi.fn();

vi.mock("@/api", () => ({
  abortChatRun: (...args: unknown[]) => abortChatRunMock(...args),
  clearSession: (...args: unknown[]) => clearSessionMock(...args),
  compactChatSession: (...args: unknown[]) => compactChatSessionMock(...args),
  createChatSession: (...args: unknown[]) => createChatSessionMock(...args),
  fetchChatSnapshot: (...args: unknown[]) => fetchChatSnapshotRequestMock(...args),
  fetchSessionPreviews: (...args: unknown[]) => fetchSessionPreviewsRequestMock(...args),
  fetchSessions: (...args: unknown[]) => fetchSessionsMock(...args),
  patchChatSession: (...args: unknown[]) => patchChatSessionMock(...args),
  patchSession: (...args: unknown[]) => patchSessionMock(...args),
  persistChatProjection: (...args: unknown[]) => persistChatProjectionMock(...args),
  resolveCanvasEval: (...args: unknown[]) => resolveCanvasEvalMock(...args),
  resetSession: (...args: unknown[]) => resetSessionMock(...args),
  sendChatMessage: (...args: unknown[]) => sendChatMessageMock(...args),
  setCanvasBridgeReady: (...args: unknown[]) => setCanvasBridgeReadyMock(...args),
  setSessionEventsSubscription: (...args: unknown[]) => setSessionEventsSubscriptionMock(...args),
  steerChatSession: (...args: unknown[]) => steerChatSessionMock(...args),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveInitialSessionSendPlan", () => {
  it("prefers the create error over a second steer attempt", () => {
    expect(
      resolveInitialSessionSendPlan({
        hasAttachments: false,
        runStarted: false,
        runError: "run failed",
      }),
    ).toEqual({
      kind: "error",
      error: "run failed",
    });
  });

  it("uses send when attachments were deferred out of sessions.create", () => {
    expect(
      resolveInitialSessionSendPlan({
        hasAttachments: true,
        runStarted: false,
      }),
    ).toEqual({
      kind: "send",
    });
  });

  it("keeps the create-started path when the first run already launched", () => {
    expect(
      resolveInitialSessionSendPlan({
        hasAttachments: false,
        runStarted: true,
      }),
    ).toEqual({
      kind: "started",
    });
  });

  it("falls back to send only when create returned no run and no error", () => {
    expect(
      resolveInitialSessionSendPlan({
        hasAttachments: false,
        runStarted: false,
      }),
    ).toEqual({
      kind: "send",
    });
  });
});

describe("fetchSessionPreviews", () => {
  it("returns remote preview overlays keyed by session", async () => {
    fetchSessionPreviewsRequestMock.mockResolvedValueOnce({
      ts: 123,
      previews: [
        {
          key: "sess-1",
          status: "ok",
          items: [
            { role: "user", text: "hello" },
            { role: "assistant", text: "world" },
          ],
        },
      ],
    });

    await expect(fetchSessionPreviews(["sess-1"])).resolves.toEqual({
      "sess-1": {
        text: "hello · world",
        updatedAt: 123,
        source: "remote",
      },
    });
  });

  it("skips empty remote preview items", async () => {
    fetchSessionPreviewsRequestMock.mockResolvedValueOnce({
      ts: 321,
      previews: [{ key: "sess-1", status: "empty", items: [] }],
    });

    await expect(fetchSessionPreviews(["sess-1"])).resolves.toEqual({
      "sess-1": null,
    });
  });
});

describe("fetchSessionList", () => {
  it("normalizes session metadata into the legacy shape", async () => {
    fetchSessionsMock.mockResolvedValueOnce({
      sessions: [
        {
          key: "sess-1",
          agentId: "main",
          title: "Session 1",
          updatedAt: 42,
          status: "running",
        },
      ],
    });

    await expect(fetchSessionList("main")).resolves.toEqual([
      {
        key: "sess-1",
        agentId: "main",
        title: "Session 1",
        updatedAt: 42,
        lastMessagePreview: undefined,
        status: "running",
        startedAt: undefined,
        endedAt: undefined,
        runtimeMs: undefined,
        model: undefined,
        modelProvider: undefined,
        thinkingLevel: undefined,
        fastMode: undefined,
        verboseLevel: undefined,
        reasoningLevel: undefined,
        responseUsage: undefined,
        sendPolicy: undefined,
        totalTokens: undefined,
        totalTokensFresh: undefined,
        estimatedCostUsd: undefined,
        parentSessionKey: undefined,
        childSessions: undefined,
        contextTokens: undefined,
        subagentRole: undefined,
        subagentControlScope: undefined,
        spawnedWorkspaceDir: undefined,
      },
    ]);
    expect(fetchSessionsMock).toHaveBeenCalledWith({ agentId: "main" });
  });
});

describe("fetchChatSnapshot", () => {
  it("maps the current snapshot response into the legacy compatibility shape", async () => {
    fetchChatSnapshotRequestMock.mockResolvedValueOnce({
      session: {
        key: "sess-1",
        agentId: "main",
        title: "Session 1",
        updatedAt: 99,
      },
      messages: [{ role: "assistant", content: [{ type: "text", text: "hello" }], timestamp: 1 }],
      activeApproval: { id: "approval-1", toolName: "exec" },
      a2uiState: { visible: true, surfaces: ["summary"] },
    });

    await expect(fetchChatSnapshot({ sessionKey: "sess-1", agentId: "main" })).resolves.toEqual({
      messages: [{ role: "assistant", content: [{ type: "text", text: "hello" }], timestamp: 1 }],
      meta: {
        key: "sess-1",
        agentId: "main",
        title: "Session 1",
        updatedAt: 99,
        lastMessagePreview: undefined,
        status: undefined,
        startedAt: undefined,
        endedAt: undefined,
        runtimeMs: undefined,
        model: undefined,
        modelProvider: undefined,
        thinkingLevel: undefined,
        fastMode: undefined,
        verboseLevel: undefined,
        reasoningLevel: undefined,
        responseUsage: undefined,
        sendPolicy: undefined,
        totalTokens: undefined,
        totalTokensFresh: undefined,
        estimatedCostUsd: undefined,
        parentSessionKey: undefined,
        childSessions: undefined,
        contextTokens: undefined,
        subagentRole: undefined,
        subagentControlScope: undefined,
        spawnedWorkspaceDir: undefined,
      },
      activeApproval: { id: "approval-1", toolName: "exec" },
      a2uiState: { visible: true, surfaces: ["summary"] },
    });
  });
});

describe("setSessionMessageSubscription", () => {
  it("forwards subscribe and unsubscribe through the current session events API", async () => {
    setSessionEventsSubscriptionMock.mockResolvedValue({ ok: true, action: "subscribe" });

    await setSessionMessageSubscription({ sessionKey: "sess-1", subscribed: true });
    await setSessionMessageSubscription({ sessionKey: "sess-1", subscribed: false });

    expect(setSessionEventsSubscriptionMock).toHaveBeenNthCalledWith(1, {
      action: "subscribe",
      sessionKey: "sess-1",
    });
    expect(setSessionEventsSubscriptionMock).toHaveBeenNthCalledWith(2, {
      action: "unsubscribe",
      sessionKey: "sess-1",
    });
  });
});
