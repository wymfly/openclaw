// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ApiExplorerPanel } from "./ApiExplorerPanel";

const apiMocks = vi.hoisted(() => ({
  fetchGatewayDescribe: vi.fn(),
  invokeGatewayMethod: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);
vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function renderApiExplorerPanel() {
  root = createRoot(container);
  root.render(
    createElement(
      DataFabricTestProvider,
      null,
      createElement(DeckIntlProvider, { locale: "en" }, createElement(ApiExplorerPanel)),
    ),
  );
}

function describePayload() {
  return {
    methods: {
      "deck.agents.list": {
        scope: "operator.read",
        since: 1,
        params: {
          type: "object",
          properties: {
            includeInactive: { type: "boolean", enum: [true, false] },
          },
        },
        result: {
          type: "object",
          required: ["agents"],
          properties: {
            agents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                },
              },
            },
          },
        },
      },
      "deck.sessions.detail": {
        scope: "operator.read",
        since: 2,
        params: {
          type: "object",
          required: ["sessionKey"],
          properties: {
            includeHistory: { type: "boolean" },
            sessionKey: { type: "string" },
          },
        },
        result: {
          type: "object",
          required: ["session"],
          properties: {
            session: {
              type: "object",
              properties: {
                key: { type: "string" },
              },
            },
          },
        },
      },
      "gateway.describe": {
        scope: "operator.read",
        since: 1,
        params: {},
        result: { type: "object" },
      },
    },
    events: {
      "deck.sessions.changed": {
        since: 2,
        payload: {
          type: "object",
          required: ["sessionKey"],
          properties: {
            sessionKey: { type: "string" },
          },
        },
      },
      "gateway.ready": {
        since: 1,
        payload: { type: "object" },
      },
    },
    untyped: ["legacy.raw"],
  };
}

function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  expect(button, `expected button ${label}`).toBeTruthy();
  fireEvent.click(button as HTMLButtonElement);
}

describe("ApiExplorerPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchGatewayDescribe.mockResolvedValue(describePayload());
    apiMocks.invokeGatewayMethod.mockResolvedValue({
      body: { agents: [{ id: "main" }] },
      headers: { "x-deck-duration-ms": "4" },
      ok: true,
      requestId: "req-1",
      statusCode: 200,
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
    vi.clearAllMocks();
  });

  it("loads the v2 method tree, request builder, response pane, and history rail", async () => {
    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(1));

    expect(container.querySelector(".api-explorer-panel__workspace")).toBeTruthy();
    expect(container.querySelector(".api-explorer-panel__tree")).toBeTruthy();
    expect(container.querySelector(".api-explorer-panel__builder-card")).toBeTruthy();
    expect(container.querySelector(".api-explorer-panel__response-card")).toBeTruthy();
    expect(container.querySelector(".api-explorer-panel__history")).toBeTruthy();
    expect(container.textContent).toContain("Gateway API Explorer");
    expect(container.textContent).toContain("Describe ready");
    expect(container.textContent).toContain("deck (2)");
    expect(container.textContent).toContain("gateway (1)");
    expect(container.textContent).toContain("deck.agents.list");
    expect(container.textContent).toContain("includeInactive");
    expect(container.textContent).toContain("No response yet");
    expect(container.textContent).toContain("Untyped methods");
    expect(container.textContent).toContain("legacy.raw");

    const metrics = Array.from(
      container.querySelectorAll<HTMLDivElement>(".api-explorer-panel__metric"),
    ).map((metric) => metric.textContent);
    expect(metrics).toEqual(expect.arrayContaining(["methods3", "events2", "untyped1"]));
  });

  it("runs a safe read-only typed method through the API wrapper and records history", async () => {
    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(1));

    await act(async () => {
      clickButton("Run");
    });

    await waitFor(() => expect(apiMocks.invokeGatewayMethod).toHaveBeenCalledTimes(1));
    expect(apiMocks.invokeGatewayMethod).toHaveBeenCalledWith(
      "deck.agents.list",
      { includeInactive: true },
      { runtimeId: "rt_local", timeoutMs: 10000 },
    );
    await waitFor(() => expect(container.textContent).toContain("200"));
    expect(container.textContent).toContain('"agents"');

    await act(async () => {
      clickButton("Trace");
    });
    expect(container.textContent).toContain("req-1");
    expect(container.textContent).toContain("History");
  });

  it("keeps JSON body parse errors local and disables run until corrected", async () => {
    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(1));

    await act(async () => {
      clickButton("Body");
    });
    const textarea = container.querySelector<HTMLTextAreaElement>(
      ".api-explorer-panel__body-editor textarea",
    );
    expect(textarea).toBeTruthy();

    await act(async () => {
      fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: "{" } });
    });

    expect(container.textContent).toMatch(/JSON|property name|Unexpected/i);
    const runButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Run",
    );
    expect(runButton?.disabled).toBe(true);
    expect(apiMocks.invokeGatewayMethod).not.toHaveBeenCalled();
  });

  it("keeps nested schema fields collapsible in the docs tab", async () => {
    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(1));

    await act(async () => {
      clickButton("Docs");
    });

    expect(container.textContent).toContain("id");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Collapse agents"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[aria-label="Expand agents"]')).toBeTruthy();
  });

  it("retries gateway.describe after a failed load", async () => {
    apiMocks.fetchGatewayDescribe
      .mockRejectedValueOnce(new Error("describe unavailable"))
      .mockResolvedValueOnce(describePayload());

    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("describe unavailable"));

    await act(async () => {
      clickButton("Refresh describe");
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(2));
    expect(container.textContent).toContain("Describe ready");
    expect(container.textContent).toContain("deck.agents.list");
  });

  it("renders first-run empty state instead of a describe error", async () => {
    apiMocks.fetchGatewayDescribe.mockRejectedValue(
      new Error("gateway_not_configured: runtime gateway is not configured"),
    );

    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() =>
      expect(container.querySelector('[data-testid="empty-state-not-configured"]')).toBeTruthy(),
    );
    expect(container.textContent).toContain(
      "Open Settings and save a remote endpoint before loading Gateway data.",
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toContain("gateway_not_configured");
  });

  it("filters methods by name or scope and switches to event inspection", async () => {
    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(1));

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="method name or scope"]',
    );
    expect(searchInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, { target: { value: "sessions" } });
    });

    const catalog = container.querySelector(".api-explorer-panel__catalog");
    expect(catalog?.textContent).toContain("deck.sessions.detail");
    expect(catalog?.textContent).not.toContain("deck.agents.list");

    const sessionMethodButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("deck.sessions.detail"),
    );
    expect(sessionMethodButton).toBeTruthy();

    await act(async () => {
      sessionMethodButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("sessionKey");
    expect(container.textContent).toContain("includeHistory");

    await act(async () => {
      clickButton("Events");
    });

    expect(container.textContent).toContain("deck.sessions.changed");
    expect(container.textContent).toContain("gateway.ready");
    expect(container.textContent).toContain("Event payload");
    expect(container.textContent).toContain("sessionKey required");
  });
});
