// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatState = {
  activeSessionKey: "sess-1" as string | null,
  sessions: new Map<string, Record<string, unknown>>(),
  sessionMetas: [] as Array<Record<string, unknown>>,
  sessionMeta: [] as Array<Record<string, unknown>>,
};

const sessionsState = {
  sessions: [] as Array<Record<string, unknown>>,
};

const patchSessionMock = vi.fn();
const executeSlashCommandMock = vi.fn();
const addToastMock = vi.fn();

vi.mock("@/stores/chat", () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => chatState,
      setState: (
        updater:
          | Partial<typeof chatState>
          | ((state: typeof chatState) => Partial<typeof chatState>),
      ) => {
        const patch = typeof updater === "function" ? updater(chatState) : updater;
        Object.assign(chatState, patch);
      },
      subscribe: vi.fn(() => vi.fn()),
      destroy: vi.fn(),
    },
  ),
}));

vi.mock("@/stores/chat-hooks", () => ({
  useActiveSessionKey: () => chatState.activeSessionKey,
}));

vi.mock("@/stores/sessions", () => ({
  useSessionsStore: (selector: (state: typeof sessionsState) => unknown) => selector(sessionsState),
}));

vi.mock("@/stores/notifications", () => ({
  useNotificationsStore: {
    getState: () => ({
      addToast: addToastMock,
    }),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        configModel: "Model",
        configModelDefault: "default",
        configReasoning: "Reasoning",
        configCompactions: "Compactions",
        configFast: "Fast",
        configUsage: "Usage",
        configSendPolicy: "Send",
        configAllow: "allow",
        configDeny: "deny",
        configReasoningToggle: "Click to cycle thinking level",
        configFastToggle: "Click to toggle fast mode",
        configUsageToggle: "Click to cycle response usage",
        configSendPolicyToggle: "Click to toggle send policy",
        contextLabel: "Context",
        searchTranscript: "Search transcript",
        compactFailed: "compact failed",
        compacting: "compacting",
        compact: "compact",
      }) as const
    )[
      key as
        | "configModel"
        | "configModelDefault"
        | "configReasoning"
        | "configCompactions"
        | "configFast"
        | "configUsage"
        | "configSendPolicy"
        | "configAllow"
        | "configDeny"
        | "configReasoningToggle"
        | "configFastToggle"
        | "configUsageToggle"
        | "configSendPolicyToggle"
        | "contextLabel"
        | "searchTranscript"
        | "compactFailed"
        | "compacting"
        | "compact"
    ] ?? key,
}));

vi.mock("../chat-api", () => ({
  patchSession: (...args: unknown[]) => patchSessionMock(...args),
}));

vi.mock("../slash-command-executor", () => ({
  executeSlashCommand: (...args: unknown[]) => executeSlashCommandMock(...args),
}));

let ChatContextBar: typeof import("../ChatContextBar").ChatContextBar;
let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ ChatContextBar } = await import("../ChatContextBar"));
  patchSessionMock.mockReset();
  patchSessionMock.mockResolvedValue(true);
  executeSlashCommandMock.mockReset();
  executeSlashCommandMock.mockResolvedValue({
    content: "",
    toastKey: "toastCompacted",
    toastType: "success",
  });
  addToastMock.mockReset();
  chatState.activeSessionKey = "sess-1";
  chatState.sessions = new Map([
    [
      "sess-1",
      {
        commandStates: {},
      },
    ],
  ]);
  chatState.sessionMetas = [
    {
      key: "sess-1",
      agentId: "main",
      updatedAt: Date.now(),
      model: "gpt-5.4",
      thinkingLevel: "low",
      fastMode: false,
      verboseLevel: "medium",
      responseUsage: "off",
      sendPolicy: "allow",
    },
  ];
  chatState.sessionMeta = chatState.sessionMetas;
  sessionsState.sessions = [];
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container.remove();
});

describe("ChatContextBar", () => {
  it("cycles thinking level and patches the session", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(ChatContextBar));
    });

    const thinkingButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("title")?.includes("cycle thinking"),
    );
    if (!thinkingButton) {
      throw new Error("missing thinking button");
    }

    thinkingButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(patchSessionMock).toHaveBeenCalledWith("sess-1", {
      thinkingLevel: "medium",
    });
    expect(chatState.sessionMetas[0]?.thinkingLevel).toBe("medium");
  });

  it("toggles fast mode and patches the session", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(ChatContextBar));
    });

    const fastButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("title")?.includes("toggle fast"),
    );
    if (!fastButton) {
      throw new Error("missing fast button");
    }

    fastButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(patchSessionMock).toHaveBeenCalledWith("sess-1", {
      fastMode: true,
    });
    expect(chatState.sessionMetas[0]?.fastMode).toBe(true);
  });

  it("cycles response usage and patches the session", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(ChatContextBar));
    });

    const usageButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("title")?.includes("cycle response usage"),
    );
    if (!usageButton) {
      throw new Error("missing usage button");
    }

    usageButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(patchSessionMock).toHaveBeenCalledWith("sess-1", {
      responseUsage: "tokens",
    });
    expect(chatState.sessionMetas[0]?.responseUsage).toBe("tokens");
  });

  it("toggles send policy and patches the session", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(ChatContextBar));
    });

    const sendPolicyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("title")?.includes("toggle send policy"),
    );
    if (!sendPolicyButton) {
      throw new Error("missing send policy button");
    }

    sendPolicyButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(patchSessionMock).toHaveBeenCalledWith("sess-1", {
      sendPolicy: "deny",
    });
    expect(chatState.sessionMetas[0]?.sendPolicy).toBe("deny");
  });

  it("invokes onToggleSearch when the search button is clicked", () => {
    const onToggleSearch = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(createElement(ChatContextBar, { onToggleSearch } as never));
    });

    const searchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("title")?.includes("Search transcript"),
    );
    if (!searchButton) {
      throw new Error("missing search button");
    }

    searchButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onToggleSearch).toHaveBeenCalledTimes(1);
  });

  it("runs compact through the slash command executor and shows command state", async () => {
    sessionsState.sessions = [{ key: "sess-1", contextTokens: 1000, totalTokens: 900 }];
    chatState.sessions = new Map([
      [
        "sess-1",
        {
          commandStates: {
            compact: {
              command: "compact",
              status: "running",
              startedAt: Date.now(),
              summary: "Compaction is running",
            },
          },
        },
      ],
    ]);

    act(() => {
      root = createRoot(container);
      root.render(createElement(ChatContextBar));
    });

    expect(container.textContent).toContain("Compaction running");
    const compactButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("compacting"),
    );
    if (!compactButton) {
      throw new Error("missing compact button");
    }
    expect(compactButton.hasAttribute("disabled")).toBe(true);

    chatState.sessions = new Map([
      [
        "sess-1",
        {
          commandStates: {},
        },
      ],
    ]);

    act(() => {
      root?.render(createElement(ChatContextBar));
    });
    const readyCompactButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("compact"),
    );
    if (!readyCompactButton) {
      throw new Error("missing ready compact button");
    }
    readyCompactButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await waitFor(() => {
      expect(executeSlashCommandMock).toHaveBeenCalledWith("sess-1", "compact", "");
    });
    expect(addToastMock).toHaveBeenCalledWith("success", "toastCompacted", 3000);
  });
});
