// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    (
      ({
        debugMessages: "Messages",
        debugTree: "Tree",
        debugEvents: `Events ${values?.count ?? 0}`,
        debugClear: "Clear",
        debugTreeUnavailable: "Tree unavailable",
        debugRefreshTree: "Refresh Tree",
      }) as Record<string, string>
    )[key] ?? key,
}));

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
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

describe("Canvas tree data plumbing", () => {
  it("stores and clears treeData through setA2UIState", async () => {
    const { useChatStore } = await import("@/stores/chat");
    useChatStore.getState().ensureSession("s1");

    useChatStore.getState().setA2UIState("s1", {
      treeData: { root: "test" },
    });
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState?.treeData).toEqual({
      root: "test",
    });

    useChatStore.getState().setA2UIState("s1", {
      treeData: undefined,
    });
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState?.treeData).toBeUndefined();
  });

  it("renders stored treeData and queues request_tree refresh commands", async () => {
    const { useChatStore } = await import("@/stores/chat");
    const { CanvasDebugPanel } = await import("../CanvasDebugPanel");
    const store = useChatStore.getState();

    store.ensureSession("s1");
    store.setActiveSession("s1");
    store.setA2UIState("s1", {
      eventLog: [],
      surfaces: ["main"],
      treeData: { root: { id: "1", children: [] } },
    });

    act(() => {
      root = createRoot(container);
      root.render(createElement(CanvasDebugPanel));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Tree" }));
    });

    expect(screen.getByText(/"root"/)).toBeDefined();
    act(() => {
      fireEvent.click(screen.getByTitle("Refresh Tree"));
    });

    const commands = useChatStore.getState().consumeCanvasCommands("s1");
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      sessionKey: "s1",
      action: "request_tree",
    });
  });

  it("falls back to surfaces when treeData is unavailable", async () => {
    const { useChatStore } = await import("@/stores/chat");
    const { CanvasDebugPanel } = await import("../CanvasDebugPanel");
    const store = useChatStore.getState();

    store.ensureSession("s2");
    store.setActiveSession("s2");
    store.setA2UIState("s2", {
      eventLog: [],
      surfaces: ["main", "sidebar"],
    });

    act(() => {
      root = createRoot(container);
      root.render(createElement(CanvasDebugPanel));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Tree" }));
    });

    expect(screen.getByText("main")).toBeDefined();
    expect(screen.getByText("sidebar")).toBeDefined();
  });
});
