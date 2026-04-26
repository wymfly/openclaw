// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatState = {
  activeSessionKey: "sess-1" as string | null,
  sessionMetas: [] as Array<Record<string, unknown>>,
  sessionMeta: [] as Array<Record<string, unknown>>,
};

const patchSessionMock = vi.fn();

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

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        configModel: "Model",
        configModelDefault: "default",
        configThinking: "Thinking",
        configFast: "Fast",
        configUsage: "Usage",
        configSendPolicy: "Send",
        configAllow: "allow",
        configDeny: "deny",
        configVerbose: "Verbose",
        configOn: "on",
        configOff: "off",
        configThinkingToggle: "Click to cycle thinking level",
        configFastToggle: "Click to toggle fast mode",
        configUsageToggle: "Click to cycle response usage",
        configSendPolicyToggle: "Click to toggle send policy",
      }) as const
    )[
      key as
        | "configModel"
        | "configModelDefault"
        | "configThinking"
        | "configFast"
        | "configUsage"
        | "configSendPolicy"
        | "configAllow"
        | "configDeny"
        | "configVerbose"
        | "configOn"
        | "configOff"
        | "configThinkingToggle"
        | "configFastToggle"
        | "configUsageToggle"
        | "configSendPolicyToggle"
    ] ?? key,
}));

vi.mock("../chat-api", () => ({
  patchSession: (...args: unknown[]) => patchSessionMock(...args),
}));

let SessionConfigBar: typeof import("../SessionConfigBar").SessionConfigBar;
let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  vi.resetModules();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  ({ SessionConfigBar } = await import("../SessionConfigBar"));
  patchSessionMock.mockReset();
  patchSessionMock.mockResolvedValue(true);
  chatState.activeSessionKey = "sess-1";
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

describe("SessionConfigBar", () => {
  it("cycles thinking level and patches the session", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SessionConfigBar));
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
      root.render(createElement(SessionConfigBar));
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
      root.render(createElement(SessionConfigBar));
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
      root.render(createElement(SessionConfigBar));
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
});
