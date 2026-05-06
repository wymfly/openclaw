// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider, type NextIntlClientProviderProps } from "../../../i18n/provider";
import { MemoryPanel } from "./MemoryPanel";

const apiMocks = vi.hoisted(() => ({
  browseMemory: vi.fn(),
  fetchAgentsList: vi.fn(),
  fetchMemoryHealth: vi.fn(),
  readMemoryFile: vi.fn(),
  runMemoryDreams: vi.fn(),
  searchMemory: vi.fn(),
}));

vi.mock("../../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function memoryFilesPayload() {
  return {
    files: [
      { name: "daily.md", path: "daily.md", type: "file" as const, size: 42 },
      { name: "archive", path: "archive", type: "directory" as const },
    ],
  };
}

function archiveFilesPayload() {
  return {
    files: [{ name: "note.md", path: "archive/note.md", type: "file" as const, size: 30 }],
  };
}

function renderMemoryPanel(locale: NextIntlClientProviderProps["locale"] = "en") {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale }, createElement(MemoryPanel)));
}

function buttonByText(text: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === text || button.textContent?.includes(text),
  ) as HTMLButtonElement;
}

describe("MemoryPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.location.hash = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchAgentsList.mockResolvedValue({
      agents: [
        { id: "main", name: "Main agent" },
        { id: "builder", name: "Builder agent" },
      ],
      defaultId: "main",
    });
    apiMocks.browseMemory.mockImplementation((_agentId: string, path?: string) =>
      Promise.resolve(path === "archive" ? archiveFilesPayload() : memoryFilesPayload()),
    );
    apiMocks.fetchMemoryHealth.mockResolvedValue({
      entries: [
        {
          agentId: "main",
          provider: "provider-a",
          embeddingStatus: "ok",
        },
      ],
      lanceDbEnabled: true,
    });
    apiMocks.readMemoryFile.mockResolvedValue({
      path: "daily.md",
      content: "# remembered context",
    });
    apiMocks.runMemoryDreams.mockImplementation((action: string, agentId = "main") =>
      Promise.resolve(
        action === "read"
          ? {
              agentId,
              found: true,
              path: ".openclaw/memory/dream-diary.md",
              content: "# Dream diary\n\nremembered dream context",
              updatedAtMs: 1_774_520_000_000,
            }
          : {
              agentId,
              action,
              changed: true,
              dedupedEntries: action === "dedupe" ? 2 : undefined,
              replaced: action === "repair" ? 2 : undefined,
            },
      ),
    );
    apiMocks.searchMemory.mockResolvedValue({
      results: [
        {
          path: "memory/core.md",
          content: "remembered context",
          relevance: 0.91,
          tier: "core",
          scope: "global",
        },
      ],
      unavailableReason: null,
      lanceDbEnabled: true,
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

  it("loads the v2 four-tab memory workspace and reads a selected file", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(apiMocks.browseMemory).toHaveBeenCalledWith("main", undefined));
    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    expect(container.querySelector(".memory-panel")).not.toBeNull();
    expect(
      Array.from(container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent),
    ).toEqual(["Browse", "Search", "Health", "Dreams"]);
    expect(container.textContent).toContain("Memory");
    expect(container.textContent).toContain("daily.md");
    expect(container.textContent).toContain("archive");

    await waitFor(() => expect(apiMocks.readMemoryFile).toHaveBeenCalledWith("main", "daily.md"));
    expect(apiMocks.browseMemory).not.toHaveBeenCalledWith("main", "daily.md");
    await waitFor(() => expect(container.textContent).toContain("remembered context"));
  });

  it("switches the browse agent from the Gateway-backed selector", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    const agentSelector = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Memory agent selector"]',
    );
    expect(agentSelector).toBeTruthy();
    expect(agentSelector?.value).toBe("main");

    await act(async () => {
      fireEvent.change(agentSelector as HTMLSelectElement, { target: { value: "builder" } });
    });

    await waitFor(() =>
      expect(apiMocks.browseMemory).toHaveBeenLastCalledWith("builder", undefined),
    );
    expect(container.textContent).toContain("agent builder");
  });

  it("lazily browses directories separately from file reads", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    await act(async () => {
      fireEvent.click(buttonByText("archive"));
    });

    await waitFor(() => expect(apiMocks.browseMemory).toHaveBeenCalledWith("main", "archive"));
    expect(apiMocks.readMemoryFile).not.toHaveBeenCalledWith("main", "archive");
    await waitFor(() => expect(container.textContent).toContain("note.md"));
  });

  it("loads health details and exposes raw health evidence", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    await act(async () => {
      fireEvent.click(buttonByText("Health"));
    });

    await waitFor(() => expect(apiMocks.fetchMemoryHealth).toHaveBeenCalled());
    expect(container.textContent).toContain("Raw health response");
    expect(container.textContent).toContain("provider-a");
    expect(container.textContent).toContain("lance dbenabled");
  });

  it("runs dream maintenance actions with inline confirmation guards", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    await act(async () => {
      fireEvent.click(buttonByText("Dreams"));
    });
    await waitFor(() => expect(apiMocks.runMemoryDreams).toHaveBeenCalledWith("read", "main"));
    expect(container.textContent).toContain("Dream diary");

    await act(async () => {
      fireEvent.click(buttonByText("Dedupe"));
    });

    await waitFor(() => expect(apiMocks.runMemoryDreams).toHaveBeenCalledWith("dedupe", "main"));
    await waitFor(() => expect(container.textContent).toContain("Dream diary action result"));
    expect(container.textContent).toContain("dedupedEntries");

    const callsAfterDedupe = apiMocks.runMemoryDreams.mock.calls.length;

    await act(async () => {
      fireEvent.click(buttonByText("Reset short-term"));
    });

    expect(container.textContent).toContain("Run memory dreams Reset short-term?");
    expect(apiMocks.runMemoryDreams).toHaveBeenCalledTimes(callsAfterDedupe);

    await act(async () => {
      fireEvent.click(buttonByText("No"));
    });

    expect(apiMocks.runMemoryDreams).toHaveBeenCalledTimes(callsAfterDedupe);
  });

  it("runs memory search with scope and surfaces LanceDB unavailable responses", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    await act(async () => {
      fireEvent.click(buttonByText("Search"));
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="search memory"]',
    );
    expect(searchInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, {
        target: { value: " remembered context " },
      });
      fireEvent.click(buttonByText("global"));
    });

    await act(async () => {
      fireEvent.click(buttonByText("Search memory"));
    });

    await waitFor(() =>
      expect(apiMocks.searchMemory).toHaveBeenCalledWith({
        query: "remembered context",
        agentId: undefined,
        scope: "global",
      }),
    );
    expect(container.textContent).toContain("/memory/core.md");
    expect(container.textContent).toContain("remembered context");

    apiMocks.searchMemory.mockResolvedValueOnce({
      results: [],
      unavailableReason: "Not implemented — requires LanceDB extension",
      lanceDbEnabled: false,
    });

    await act(async () => {
      fireEvent.click(buttonByText("Search memory"));
    });

    await waitFor(() =>
      expect(container.textContent).toContain("Not implemented — requires LanceDB extension"),
    );
    expect(container.textContent).toContain("No memory search results loaded.");
  });

  it("renders the memory workbench in Chinese", async () => {
    await act(async () => {
      renderMemoryPanel("zh");
    });

    await waitFor(() => expect(container.textContent).toContain("记忆就绪"));
    expect(container.textContent).toContain("记忆");
    expect(
      Array.from(container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent),
    ).toEqual(["浏览", "搜索", "健康诊断", "梦境"]);
    expect(container.textContent).toContain("文件树");
    await waitFor(() => expect(container.textContent).toContain("remembered context"));
  });
});
