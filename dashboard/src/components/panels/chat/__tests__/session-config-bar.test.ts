// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        configModel: "Model",
        configModelDefault: "default",
        configThinking: "Thinking",
        configFast: "Fast",
        configVerbose: "Verbose",
        configOn: "on",
        configOff: "off",
        configThinkingToggle: "Click to cycle thinking level",
        configFastToggle: "Click to toggle fast mode",
      }) as const
    )[
      key as
        | "configModel"
        | "configModelDefault"
        | "configThinking"
        | "configFast"
        | "configVerbose"
        | "configOn"
        | "configOff"
        | "configThinkingToggle"
        | "configFastToggle"
    ] ?? key,
}));

vi.mock("../chat-api", () => ({
  patchSession: vi.fn().mockResolvedValue(true),
}));

let SessionConfigBar: typeof import("../SessionConfigBar").SessionConfigBar;
let useChatStore: typeof import("@/stores/chat").useChatStore;
let patchSession: typeof import("../chat-api").patchSession;

beforeEach(async () => {
  vi.resetModules();
  ({ SessionConfigBar } = await import("../SessionConfigBar"));
  ({ useChatStore } = await import("@/stores/chat"));
  ({ patchSession } = await import("../chat-api"));

  const metas = [
    {
      key: "sess-1",
      agentId: "main",
      updatedAt: Date.now(),
      model: "gpt-5.4",
      thinkingLevel: "low",
      fastMode: false,
      verboseLevel: "medium",
    },
  ];

  useChatStore.setState({
    activeSessionKey: "sess-1",
    sessionMetas: metas,
    sessionMeta: metas,
  });

  vi.mocked(patchSession).mockClear();
});

afterEach(() => {
  cleanup();
});

describe("SessionConfigBar", () => {
  it("cycles thinking level and patches the session", () => {
    render(createElement(SessionConfigBar));

    const thinkingButton = screen.getByTitle("Click to cycle thinking level");
    fireEvent.click(thinkingButton);

    expect(vi.mocked(patchSession)).toHaveBeenCalledWith("sess-1", {
      thinkingLevel: "medium",
    });
    expect(thinkingButton.textContent).toContain("medium");
  });

  it("toggles fast mode and patches the session", () => {
    render(createElement(SessionConfigBar));

    const fastButton = screen.getByTitle("Click to toggle fast mode");
    fireEvent.click(fastButton);

    expect(vi.mocked(patchSession)).toHaveBeenCalledWith("sess-1", {
      fastMode: true,
    });
    expect(fastButton.textContent).toContain("on");
  });
});
