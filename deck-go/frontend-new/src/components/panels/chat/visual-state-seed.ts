import { useAgentsStore } from "@/stores/agents";
import { useApprovalsStore } from "@/stores/approvals";
import { useChatStore } from "@/stores/chat";
import type { ChatMessage, SessionMeta } from "@/stores/chat-types";

const VISUAL_STATE_PARAM = "deckVisualState";
const LEGACY_VISUAL_STATE_PARAM = "visualState";
const CHAT_RICH_STATE = "chat-rich";
const CHAT_EMPTY_STATE = "chat-empty";
const VISUAL_STATE_ENV = "VITE_DECK_VISUAL_STATE";

function canSeedVisualState() {
  return (
    import.meta.env.DEV ||
    import.meta.env.MODE === "test" ||
    import.meta.env[VISUAL_STATE_ENV] === "1"
  );
}

function readRequestedVisualState(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get(VISUAL_STATE_PARAM) ?? params.get(LEGACY_VISUAL_STATE_PARAM);
}

function isSupportedVisualState(state: string | null) {
  return state === CHAT_RICH_STATE || state === CHAT_EMPTY_STATE;
}

function seedAgents(status: "idle" | "busy") {
  useAgentsStore.setState((agentsState) => ({
    agents: [
      { id: "main", name: "Main Agent", model: "gpt-5.4", status },
      { id: "ops", name: "Ops Bot", model: "sonnet-4.6", status: "idle" },
    ],
    fetchAgents: agentsState.fetchAgents,
  }));
}

function readCurrentLocationSearch() {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.location.search;
  } catch {
    try {
      return new URL(window.location.href).search;
    } catch {
      return "";
    }
  }
}

export function isChatVisualStateRequested(search?: string): boolean {
  return (
    canSeedVisualState() &&
    isSupportedVisualState(readRequestedVisualState(search ?? readCurrentLocationSearch()))
  );
}

function seededSessionMetas(now: number): SessionMeta[] {
  return [
    {
      key: "visual-main",
      agentId: "main",
      title: "Gateway startup regression triage",
      lastMessagePreview: "Tool result reviewed, approval pending",
      updatedAt: now,
      status: "running",
      model: "gpt-5.4",
      totalTokens: 97_200,
      contextTokens: 100_000,
      compactionCount: 2,
      fastMode: false,
      reasoningLevel: "stream",
      responseUsage: "tokens",
      sendPolicy: "allow",
    },
    {
      key: "visual-long-title",
      agentId: "main",
      title: "A very long bilingual session title for truncation 验证导航列表不会溢出到删除按钮",
      lastMessagePreview: "Preview text remains dense but readable in the old Deck row layout.",
      updatedAt: now - 40 * 60_000,
      status: "done",
      model: "sonnet-4.6",
    },
    {
      key: "visual-tools",
      agentId: "ops",
      title: "Tool rendering and artifact handoff",
      lastMessagePreview: "Generated an artifact and opened the canvas drawer.",
      updatedAt: now - 2 * 60 * 60_000,
      status: "done",
      model: "gpt-5.4",
    },
  ];
}

function seededMessages(now: number): ChatMessage[] {
  return [
    {
      id: "visual-user-1",
      role: "user",
      timestamp: now - 6 * 60_000,
      content: [
        {
          type: "text",
          text: "The Gateway starts locally but the Deck client keeps reconnecting. Please inspect the startup path and summarize the most likely failure.",
        },
      ],
    },
    {
      id: "visual-assistant-1",
      role: "assistant",
      timestamp: now - 5 * 60_000,
      content: [
        {
          type: "thinking",
          text: "I need to compare the configured endpoint, the managed Gateway command, and the last API error before recommending a fix.",
        },
        {
          type: "tool_use",
          id: "tool-read-settings",
          name: "read_file",
          input: { path: "deck-go/config.json", reason: "check managed Gateway launch config" },
        },
        {
          type: "tool_result",
          toolUseId: "tool-read-settings",
          content:
            '{\n  "managedGateway": {\n    "command": "pnpm",\n    "args": ["openclaw", "gateway", "run", "--force"],\n    "bindPort": 18789\n  }\n}',
        },
        {
          type: "text",
          text: "The local launch contract looks correct. The remaining risk is the frontend hitting the Vite fallback instead of the Go API proxy, which explains the HTML response in the JSON parser.",
        },
      ],
    },
    {
      id: "visual-assistant-rich-content",
      role: "assistant",
      timestamp: now - 4 * 60_000 - 30_000,
      content: [
        {
          type: "tool_use",
          id: "tool-render-structured",
          name: "openclaw_canvas_preview",
          input: {
            viewId: "visual-canvas-checklist",
            url: "/__openclaw__/canvas/documents/visual-checklist.html",
          },
        },
        {
          type: "tool_result",
          toolUseId: "tool-render-structured",
          content: [
            {
              type: "text",
              text: "Structured content preserved from Gateway: inline canvas, image, file, and unknown fallback all stay visible.",
            },
            {
              type: "canvas",
              kind: "canvas",
              surface: "assistant_message",
              render: "url",
              url: "/__openclaw__/canvas/documents/visual-checklist.html",
              viewId: "visual-canvas-checklist",
              title: "Gateway readiness canvas",
              preferredHeight: 220,
            },
            {
              type: "image",
              mimeType: "image/png",
              fileName: "gateway-status.png",
              data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
            },
            {
              type: "file",
              mimeType: "text/plain",
              fileName: "gateway-summary.txt",
              size: 28,
              data: "R2F0ZXdheSBzdHJ1Y3R1cmVkIHJlc3VsdAo=",
            },
            {
              type: "unknown",
              rawType: "debug_delta",
              summary: {
                type: "debug_delta",
                keys: ["phase", "durationMs", "source"],
                phase: "canonicalization",
              },
            },
          ],
        },
        {
          type: "tool_use",
          id: "tool-write-artifact",
          name: "write_file",
          input: { path: "/tmp/deck-go-rich-content-report.md" },
        },
        {
          type: "tool_result",
          toolUseId: "tool-write-artifact",
          content:
            "# Rich content report\n\n- Canvas block routed through Deck BFF\n- Unknown block preserved for review\n- Tool details collapsed by default\n",
        },
      ],
    },
    {
      id: "compaction-visual-1",
      role: "system",
      timestamp: now - 4 * 60_000,
      tokensBefore: 128_000,
      tokensAfter: 42_000,
      isCompaction: true,
      content: [{ type: "text", text: "compacted" }],
    },
    {
      id: "visual-user-2",
      role: "user",
      timestamp: now - 2 * 60_000,
      content: [
        {
          type: "text",
          text: "Open the canvas and keep the approval visible so I can compare the old Deck spacing.",
        },
      ],
    },
    {
      id: "visual-assistant-streaming",
      role: "assistant",
      timestamp: now - 30_000,
      streaming: true,
      content: [
        {
          type: "text",
          text: "I have the transcript, tool ladder, approval prompt, and canvas drawer visible. I am now checking responsive spacing",
        },
      ],
    },
  ];
}

export function applyChatVisualStateSeed(search?: string): boolean {
  const state = readRequestedVisualState(search ?? readCurrentLocationSearch());
  if (!canSeedVisualState() || !isSupportedVisualState(state)) {
    return false;
  }

  if (state === CHAT_EMPTY_STATE) {
    const store = useChatStore.getState();
    seedAgents("idle");
    store.setActiveAgent("main");
    store.setSessionMetas([]);
    store.setActiveSession(null);
    store.setSSEStatus("connected");
    return true;
  }

  const now = Date.UTC(2026, 3, 26, 14, 0, 0);
  const approvalNow = Date.now();
  const sessionKey = "visual-main";
  const store = useChatStore.getState();
  const metas = seededSessionMetas(now);
  seedAgents("busy");
  const approval = {
    id: "visual-approval-1",
    toolName: "shell_command",
    command: "pnpm openclaw gateway run --bind loopback --port 18789 --force",
    agentId: "main",
    sessionKey,
    cwd: "/workspace/openclaw",
    createdAtMs: approvalNow - 45_000,
    expiresAtMs: approvalNow + 20 * 60_000,
  };

  store.setActiveAgent("main");
  store.setSessionMetas(metas);
  store.setActiveSession(sessionKey);
  store.setMessages(sessionKey, seededMessages(now));
  store.mergeSessionPreviewOverlay(sessionKey, {
    text: "Visual seed: streaming response with approval and canvas drawer.",
    updatedAt: now,
    source: "optimistic",
  });
  store.setStreaming(sessionKey, true, "visual-run-1");
  store.updateSessionState(sessionKey, {
    status: "running",
    startedAt: now - 6 * 60_000,
    runtimeMs: 360_000,
    fastMode: false,
  });
  store.setRunMetadata(sessionKey, "visual-assistant-streaming", {
    runId: "visual-run-1",
    model: "gpt-5.4",
    usage: { input: 12_440, output: 840, cache: 3_200 },
    cacheReadTokens: 3_200,
    cacheWriteTokens: 480,
    cacheHit: 0.84,
    cost: 0.0123,
    durationMs: 42_000,
    startedAt: now - 42_000,
    streaming: true,
  });
  store.updateToolProgress(sessionKey, "tool-read-settings", {
    toolUseId: "tool-read-settings",
    name: "read_file",
    status: "completed",
    startedAt: now - 5 * 60_000,
    completedAt: now - 4 * 60_000,
  });
  store.updateToolProgress(sessionKey, "tool-run-gateway", {
    toolUseId: "tool-run-gateway",
    name: "shell_command",
    status: "running",
    startedAt: now - 25_000,
  });
  store.setActiveApproval(sessionKey, approval);
  store.setA2UIState(sessionKey, {
    visible: true,
    url: "visual-seed:gateway-checklist",
    bridgeStatus: "ready",
    surfaces: ["canvas", "artifact"],
    eventLog: [
      {
        timestamp: now - 30_000,
        direction: "inbound",
        action: "present",
        summary: "Rendered Gateway launch checklist",
        raw: { kind: "visual-seed" },
      },
    ],
  });
  store.setSSEStatus("connected");
  useApprovalsStore.getState().addPending({
    id: approval.id,
    command: approval.command,
    agentId: approval.agentId,
    sessionKey: approval.sessionKey,
    createdAtMs: approval.createdAtMs,
    expiresAtMs: approval.expiresAtMs,
  });

  return true;
}
