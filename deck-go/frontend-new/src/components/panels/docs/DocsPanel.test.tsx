// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "../../../data/testing/DataFabricTestProvider";
import { DeckIntlProvider, type NextIntlClientProviderProps } from "../../../i18n/provider";
import { DocsPanel } from "./DocsPanel";

const apiMocks = vi.hoisted(() => ({
  deleteDoc: vi.fn(),
  extractDocs: vi.fn(),
  fetchDoc: vi.fn(),
  fetchDocs: vi.fn(),
}));

const deckUIMocks = vi.hoisted(() => ({
  navigateToAgent: vi.fn(),
  navigateToSession: vi.fn(),
  ui: { setActivePanel: vi.fn() },
}));

vi.mock("../../../api", () => apiMocks);
vi.mock("../../../deck-ui/panel-navigation", () => ({
  navigateToAgent: deckUIMocks.navigateToAgent,
  navigateToSession: deckUIMocks.navigateToSession,
}));
vi.mock("../../../deck-ui/ui-store", () => ({
  useDeckUI: () => deckUIMocks.ui,
}));
vi.mock("../../../stores/chat-hooks", () => ({
  useActiveSessionKey: () => "sess-active",
}));

let container: HTMLDivElement;
let root: Root | null = null;

function renderPanel(locale: NextIntlClientProviderProps["locale"] = "en") {
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricTestProvider,
        null,
        createElement(DeckIntlProvider, { locale }, createElement(DocsPanel)),
      ),
    );
  });
}

function docsPayload() {
  return {
    docs: [
      {
        id: "doc-summary",
        title: "Project Summary",
        category: "summary",
        content: "# Summary\n\nSummary content with project notes.\n\n## Decisions\n\n- Use BFF.",
        sourceSession: "sess-main",
        sourceAgent: "main",
        keywords: ["summary", "project"],
        language: "en",
        extractedAt: "2026-04-24T08:00:00Z",
        updatedAt: "2026-04-24T09:00:00Z",
      },
      {
        id: "doc-api",
        title: "API Spec",
        category: "spec",
        content:
          "# API Spec\n\nAPI details for localstore and schema.\n\n## Routes\n\n- GET /api/docs",
        sourceSession: "sess-api",
        sourceAgent: "builder",
        keywords: ["api", "schema"],
        language: "en",
        extractedAt: "2026-04-24T08:30:00Z",
        updatedAt: "2026-04-24T09:30:00Z",
      },
    ],
  };
}

function docDetail(docId: string) {
  const doc = docsPayload().docs.find((item) => item.id === docId);
  if (!doc) {
    throw new Error(`unknown doc ${docId}`);
  }
  return {
    ...doc,
    content: `# ${doc.title}\n\n${doc.content} from detail route\n\n## Detail Heading\n\n- migrated docs viewer`,
  };
}

describe("DocsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState(null, "", "/");
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchDocs.mockResolvedValue(docsPayload());
    apiMocks.fetchDoc.mockImplementation((docId: string) => Promise.resolve(docDetail(docId)));
    apiMocks.extractDocs.mockResolvedValue({ extracted: 2, docs: [docsPayload().docs[1]] });
    apiMocks.deleteDoc.mockResolvedValue({ ok: true, id: "doc-api" });
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

  it("loads docs into the v2 workbench and renders selected document evidence", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchDocs).toHaveBeenCalledWith());
    await waitFor(() => expect(apiMocks.fetchDoc).toHaveBeenCalledWith("doc-summary"));

    expect(container.querySelector('[data-testid="docs-panel"]')).toBeTruthy();
    expect(container.querySelector(".docs-panel__topbar")).toBeTruthy();
    expect(container.querySelector(".docs-panel__workspace")).toBeTruthy();
    expect(container.querySelector(".docs-panel__tree")).toBeTruthy();
    expect(container.querySelector(".docs-panel__reader")).toBeTruthy();
    expect(container.textContent).toContain("Doc Hub");
    expect(container.textContent).toContain("extracted from sessions");
    expect(container.textContent).toContain("Docs ready");
    expect(container.textContent).toContain("2 docs");
    expect(container.textContent).toContain("active session sess-active");
    expect(container.textContent).toContain("Summaries");
    expect(container.textContent).toContain("Specs");
    expect(container.textContent).toContain("Project Summary");
    expect(container.textContent).toContain("Summary content with project notes");
    expect(container.textContent).toContain("Source");
    expect(container.textContent).toContain("sess-main");
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("On this page");
    expect(container.textContent).toContain("All keywords");
    expect(container.textContent).toContain("Doc payload");
    expect(
      Array.from(container.querySelectorAll('[data-markdown-mode="static"] h2')).some((heading) =>
        heading.textContent?.includes("Detail Heading"),
      ),
    ).toBe(true);
    expect(container.querySelector("[style]")).toBeNull();

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open source session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToSession).toHaveBeenCalledWith(deckUIMocks.ui, "sess-main");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open source agent")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(deckUIMocks.navigateToAgent).toHaveBeenCalledWith(deckUIMocks.ui, "main");
  });

  it("supports local search, keyword filtering, extraction, and confirmation-gated delete", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchDocs).toHaveBeenCalledTimes(1));

    const queryInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search docs... (⌘K)"]',
    );
    expect(queryInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(queryInput as HTMLInputElement, { target: { value: "api" } });
    });

    expect(container.textContent).toContain("1 matches");
    const firstSearchResult = container.querySelector<HTMLButtonElement>(
      ".docs-panel__search-list button",
    );
    expect(firstSearchResult?.textContent).toContain("API Spec");

    await act(async () => {
      firstSearchResult?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchDoc).toHaveBeenCalledWith("doc-api"));
    expect(container.textContent).toContain("API details for localstore and schema");

    await act(async () => {
      Array.from(container.querySelectorAll(".docs-panel__keyword-row button"))
        .find((button) => button.textContent?.includes("api"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Keyword filter: api");
    expect(container.querySelector('[data-doc-id="doc-summary"]')).toBeNull();
    expect(container.querySelector('[data-doc-id="doc-api"]')).toBeTruthy();

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Extract from session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Active session");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Extract Docs")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.extractDocs).toHaveBeenCalledWith("sess-active"));
    expect(container.textContent).toContain("Last docs action");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(apiMocks.deleteDoc).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Delete this doc?");
    expect(container.textContent).toContain("Confirm delete");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Cancel")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Delete this doc?");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Confirm delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.deleteDoc).toHaveBeenCalledWith("doc-api"));
  });

  it("renders empty, search-empty, and load error states without legacy classes", async () => {
    apiMocks.fetchDocs.mockResolvedValueOnce({ docs: [] });
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchDocs).toHaveBeenCalledWith());
    expect(container.textContent).toContain("No docs loaded");
    expect(container.querySelectorAll(".docs-panel__doc-row")).toHaveLength(0);
    expect(container.querySelector(".deck-ui-docs")).toBeNull();

    act(() => {
      root?.unmount();
    });
    root = null;
    container.innerHTML = "";
    vi.clearAllMocks();
    apiMocks.fetchDocs.mockResolvedValue(docsPayload());
    apiMocks.fetchDoc.mockImplementation((docId: string) => Promise.resolve(docDetail(docId)));

    renderPanel();
    await waitFor(() => expect(apiMocks.fetchDocs).toHaveBeenCalledWith());
    const queryInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search docs... (⌘K)"]',
    );
    await act(async () => {
      fireEvent.change(queryInput as HTMLInputElement, { target: { value: "does-not-exist" } });
    });
    expect(container.textContent).toContain("No docs match. Try fewer terms");

    act(() => {
      root?.unmount();
    });
    root = null;
    container.innerHTML = "";
    vi.clearAllMocks();
    apiMocks.fetchDocs.mockRejectedValueOnce(new Error("docs unavailable"));

    renderPanel();
    await waitFor(() => expect(container.textContent).toContain("docs unavailable"));
    expect(container.querySelector(".docs-panel__error")).toBeTruthy();
  });

  it("renders the docs workbench in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() => expect(apiMocks.fetchDocs).toHaveBeenCalledWith());
    await waitFor(() => expect(container.textContent).toContain("文档就绪"));

    expect(container.textContent).toContain("文档就绪");
    expect(container.textContent).toContain("2 份文档");
    expect(container.textContent).toContain("活跃 session sess-active");
    expect(container.textContent).toContain("文档中心");
    expect(container.textContent).toContain("从 session 提取");
  });
});
