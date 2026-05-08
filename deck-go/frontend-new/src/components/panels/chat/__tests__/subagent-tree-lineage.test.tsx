// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "@/data/testing/DataFabricTestProvider";
import { useChatStore } from "@/stores/chat";

const fetchSubagentLineage = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      ({
        subagents: "Subagents",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("@/api", () => ({
  fetchSubagentLineage: (...args: unknown[]) => fetchSubagentLineage(...args),
}));

let container: HTMLDivElement;
let root: Root | null = null;

describe("chat SubagentTree lineage fetch", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    fetchSubagentLineage.mockResolvedValue({
      root: { sessionKey: "sess-1", agentId: "main" },
      nodes: [
        {
          runId: "run-child-1",
          sessionKey: "child-1",
          agentId: "worker",
          agentName: "Worker",
          task: "Investigate gateway",
          depth: 1,
          parentRunId: "root",
          status: "running",
        },
      ],
    });
    useChatStore.setState({
      sessions: new Map(),
      sessionMetas: [],
      sessionMeta: [],
      sessionPreviewOverlays: {},
      activeSessionKey: "sess-1",
      activeAgentId: "main",
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
    fetchSubagentLineage.mockReset();
  });

  it("fetches lineage for the active session and renders child agents", async () => {
    const { SubagentTree } = await import("../SubagentTree");

    act(() => {
      root = createRoot(container);
      root.render(createElement(DataFabricTestProvider, null, createElement(SubagentTree)));
    });

    await waitFor(() => {
      expect(fetchSubagentLineage).toHaveBeenCalledWith({ sessionKey: "sess-1" });
    });

    expect(await screen.findByText("Worker")).toBeTruthy();
    expect(screen.getByText("Investigate gateway")).toBeTruthy();
  });

  it("renders lineage as a collapsible parent-child tree", async () => {
    fetchSubagentLineage.mockResolvedValueOnce({
      root: { sessionKey: "sess-1", agentId: "main" },
      nodes: [
        {
          runId: "run-parent",
          sessionKey: "child-parent",
          agentId: "builder",
          agentName: "Builder",
          task: "Build feature",
          depth: 0,
          parentRunId: "",
          status: "running",
          durationMs: 1500,
        },
        {
          runId: "run-child",
          sessionKey: "child-reviewer",
          agentId: "reviewer",
          agentName: "Reviewer",
          task: "Review feature",
          depth: 1,
          parentRunId: "run-parent",
          status: "completed",
          durationMs: 900,
        },
      ],
    });
    const { SubagentTree } = await import("../SubagentTree");

    act(() => {
      root = createRoot(container);
      root.render(createElement(DataFabricTestProvider, null, createElement(SubagentTree)));
    });

    expect(await screen.findByText("Builder")).toBeTruthy();
    expect(screen.getByText("Reviewer")).toBeTruthy();
    expect(screen.getByText("1.5s")).toBeTruthy();

    const parentButton = container.querySelector<HTMLButtonElement>(
      'button[data-run-id="run-parent"]',
    );
    expect(parentButton).toBeTruthy();
    expect(parentButton?.getAttribute("aria-expanded")).toBe("true");

    act(() => {
      fireEvent.click(parentButton as HTMLButtonElement);
    });

    expect(parentButton?.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Reviewer")).toBeNull();
  });
});
