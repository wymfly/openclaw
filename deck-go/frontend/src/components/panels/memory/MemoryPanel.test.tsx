// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeckIntlProvider } from "../../../i18n/provider";
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

function renderMemoryPanel() {
  root = createRoot(container);
  root.render(createElement(DeckIntlProvider, { locale: "en" }, createElement(MemoryPanel)));
}

describe("MemoryPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.spyOn(window, "confirm").mockReturnValue(true);
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
    apiMocks.runMemoryDreams.mockImplementation((action: string) =>
      Promise.resolve(
        action === "read"
          ? {
              agentId: "main",
              found: true,
              path: ".openclaw/memory/dream-diary.md",
              content: "# Dream diary\n\nremembered dream context",
              updatedAtMs: 1_774_520_000_000,
            }
          : {
              agentId: "main",
              action,
              changed: true,
              dedupedEntries: action === "dedupe" ? 2 : undefined,
              repaired: action === "repair" ? 2 : undefined,
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
    vi.restoreAllMocks();
  });

  it("loads memory files and reads the selected file through the stable browse/read lane", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(apiMocks.browseMemory).toHaveBeenCalledWith("main", undefined));
    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    expect(container.querySelector(".deck-ui-memory")).not.toBeNull();
    expect(container.querySelectorAll(".deck-ui-memory-card")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-memory-input")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-memory-tab")).toHaveLength(5);
    expect(container.querySelectorAll(".deck-ui-memory-row")).toHaveLength(2);
    expect(container.querySelector(".deck-ui-memory-empty")).not.toBeNull();
    expect(apiMocks.fetchAgentsList).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Main agent");
    expect(container.textContent).toContain("Builder agent");
    expect(container.textContent).toContain("entries2");
    expect(container.textContent).toContain("daily.md");
    expect(container.textContent).toContain("file | daily.md | size: 42");
    expect(container.textContent).toContain("directory | archive | size: n/a");
    expect(container.textContent).toContain("Select a memory file to read it.");

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((button) =>
          button.textContent?.includes("daily.md"),
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.readMemoryFile).toHaveBeenCalledWith("main", "daily.md"));
    expect(apiMocks.browseMemory).not.toHaveBeenCalledWith("main", "daily.md");
    await waitFor(() => expect(container.textContent).toContain("# remembered context"));

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("daily.md");
  });

  it("switches memory browse agent from the Gateway-backed agent selector", async () => {
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

  it("browses directories separately from file reads and can return to the parent path", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));
    expect(container.textContent).toContain("browsing memory root");

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find((button) =>
          button.textContent?.includes("archive"),
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.browseMemory).toHaveBeenCalledWith("main", "archive"));
    expect(apiMocks.readMemoryFile).not.toHaveBeenCalledWith("main", "archive");
    expect(container.textContent).toContain("browsing archive");
    expect(container.textContent).toContain("archive/note.md");
    expect(container.textContent).toContain("Back to parent");

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Back to parent",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.browseMemory).toHaveBeenLastCalledWith("main", undefined));
    expect(container.textContent).toContain("browsing memory root");
  });

  it("loads health details and runs dream-diary actions without touching file reads", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Health",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.fetchMemoryHealth).toHaveBeenCalledTimes(1));
    expect(container.textContent).toContain("Health payload");
    expect(container.textContent).toContain("Raw health response");
    expect(container.textContent).toContain("provider-a");
    expect(container.textContent).toContain("lance dbenabled");

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Dreams",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.runMemoryDreams).toHaveBeenCalledWith("read"));
    expect(container.textContent).toContain("Dream diary");
    expect(container.textContent).toContain(".openclaw/memory/dream-diary.md");
    expect(container.textContent).toContain("remembered dream context");

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Read",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.runMemoryDreams).toHaveBeenCalledWith("read"));
    expect(container.textContent).toContain("found");
    expect(apiMocks.readMemoryFile).not.toHaveBeenCalled();
  });

  it("runs dream maintenance actions with confirmation guards", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Dreams",
        ) as HTMLButtonElement,
      );
    });
    await waitFor(() => expect(apiMocks.runMemoryDreams).toHaveBeenCalledWith("read"));

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Dedupe",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.runMemoryDreams).toHaveBeenCalledWith("dedupe"));
    await waitFor(() => expect(container.textContent).toContain("Dream diary action result"));
    expect(container.textContent).toContain('"dedupedEntries": 2');
    expect(window.confirm).not.toHaveBeenCalled();

    const callsAfterDedupe = apiMocks.runMemoryDreams.mock.calls.length;
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Reset short-term",
        ) as HTMLButtonElement,
      );
    });

    expect(window.confirm).toHaveBeenCalledWith("Run memory dreams resetShortTerm?");
    expect(apiMocks.runMemoryDreams).toHaveBeenCalledTimes(callsAfterDedupe);

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Repair",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.runMemoryDreams).toHaveBeenCalledWith("repair"));
  });

  it("renders knowledge graph nodes from the browsed file list", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Graph",
        ) as HTMLButtonElement,
      );
    });

    await waitFor(() => expect(apiMocks.browseMemory).toHaveBeenLastCalledWith("main", undefined));
    expect(container.textContent).toContain("Knowledge graph");
    expect(container.textContent).toContain("nodes2");
    expect(container.textContent).toContain("directories1");
    expect(container.textContent).toContain("daily.md");
    expect(container.textContent).toContain("archive");
    expect(container.textContent).toContain("connections: 1");
    expect(container.textContent).toContain("Memory graph nodes");
  });

  it("runs memory search with scope and surfaces LanceDB unavailable responses", async () => {
    await act(async () => {
      renderMemoryPanel();
    });

    await waitFor(() => expect(container.textContent).toContain("Memory ready"));

    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent === "Search",
        ) as HTMLButtonElement,
      );
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="search memory"]',
    );
    const scopeSelect = Array.from(container.querySelectorAll<HTMLSelectElement>("select")).find(
      (select) => select.value === "all" || select.value === "global",
    );
    expect(searchInput).toBeTruthy();
    expect(scopeSelect).toBeTruthy();

    await act(async () => {
      fireEvent.change(searchInput as HTMLInputElement, {
        target: { value: " remembered context " },
      });
      fireEvent.change(scopeSelect as HTMLSelectElement, { target: { value: "global" } });
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Search memory")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(apiMocks.searchMemory).toHaveBeenCalledWith({
        query: "remembered context",
        agentId: "main",
        scope: "global",
      }),
    );
    expect(container.textContent).toContain("memory/core.md");
    expect(container.textContent).toContain("remembered context");
    expect(container.textContent).toContain("relevance: 0.91 | tier: core | scope: global");
    expect(container.textContent).toContain("Memory search results");

    apiMocks.searchMemory.mockResolvedValueOnce({
      results: [],
      unavailableReason: "Not implemented — requires LanceDB extension",
      lanceDbEnabled: false,
    });

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Search memory")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() =>
      expect(container.textContent).toContain("Not implemented — requires LanceDB extension"),
    );
    expect(container.textContent).toContain("No memory search results loaded.");
  });
});
