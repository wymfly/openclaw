// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
import { ApiExplorerPanel } from "./ApiExplorerPanel";

const apiMocks = vi.hoisted(() => ({
  fetchGatewayDescribe: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function renderApiExplorerPanel() {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale: "en" }, createElement(ApiExplorerPanel)));
}

function describePayload() {
  return {
    methods: {
      "deck.agents.list": {
        scope: "operator.read",
        since: 1,
        params: {
          type: "object",
          required: ["agentId"],
          properties: {
            agentId: { type: "string" },
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

describe("ApiExplorerPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchGatewayDescribe.mockResolvedValue(describePayload());
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

  it("loads gateway.describe methods, groups them by domain, and selects the first method", async () => {
    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("Describe ready");
    expect(container.textContent).toContain("3 methods");
    expect(container.textContent).toContain("2 events");
    expect(container.textContent).toContain("1 untyped");
    expect(container.textContent).toContain("deck (2)");
    expect(container.textContent).toContain("gateway (1)");
    expect(container.textContent).toContain("deck.agents.list");
    expect(container.textContent).toContain("agentId required");
    expect(container.textContent).toContain("includeInactive");
    expect(container.textContent).toContain("enum: true, false");
    expect(container.querySelector(".deck-ui-api-explorer")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-api-card").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-api-row").length).toBe(3);
    expect(container.querySelectorAll(".deck-ui-api-surface").length).toBe(2);
    expect(container.querySelectorAll(".deck-ui-api-schema-row").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".deck-ui-api-input")).toBeTruthy();
    expect(container.querySelector(".deck-ui-api-hero")).toBeTruthy();
    expect(container.querySelector('[aria-label="Collapse agents"]')).toBeTruthy();
    expect(container.textContent).toContain("Untyped methods");
    expect(container.textContent).toContain("legacy.raw");

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("deck.agents.list");
  });

  it("keeps nested schema fields collapsible like the old explorer", async () => {
    await act(async () => {
      renderApiExplorerPanel();
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(1));

    expect(container.textContent).toContain("id");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Collapse agents"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[aria-label="Expand agents"]')).toBeTruthy();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Expand agents"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[aria-label="Collapse agents"]')).toBeTruthy();
    expect(container.textContent).toContain("id");
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
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Refresh describe")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchGatewayDescribe).toHaveBeenCalledTimes(2));
    expect(container.textContent).toContain("Describe ready");
    expect(container.textContent).toContain("deck.agents.list");
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

    expect(container.textContent).toContain("deck (1)");
    expect(container.textContent).toContain("deck.sessions.detail");

    const sessionMethodButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("deck.sessions.detail"),
    );
    expect(sessionMethodButton).toBeTruthy();

    await act(async () => {
      sessionMethodButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("required");
    expect(container.textContent).toContain("sessionKey");
    expect(container.textContent).toContain("includeHistory");
    expect(container.textContent).toContain("type: boolean");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Events")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("deck.sessions.changed");
    expect(container.textContent).toContain("gateway.ready");
    expect(container.textContent).toContain("Event payload");
    expect(container.textContent).toContain("sessionKey required");
  });
});
