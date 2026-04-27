// @vitest-environment jsdom
import { fireEvent, waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    root.render(createElement(DeckIntlProvider, { locale }, createElement(DocsPanel)));
  });
}

function docsPayload() {
  return {
    docs: [
      {
        id: "doc-summary",
        title: "Project Summary",
        category: "summary",
        content: "Summary content",
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
        content: "API details",
        sourceSession: "sess-api",
        sourceAgent: "builder",
        keywords: ["api"],
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
    content: `## Detail Heading\n\n${doc.content} from detail route\n\n- migrated docs viewer`,
  };
}

describe("DocsPanel", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchDocs.mockResolvedValue(docsPayload());
    apiMocks.fetchDoc.mockImplementation((docId: string) => Promise.resolve(docDetail(docId)));
    apiMocks.extractDocs.mockResolvedValue({ extracted: 2, docs: docsPayload().docs });
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

  it("loads docs, category summaries, and the first document detail", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchDocs).toHaveBeenCalledWith());

    expect(container.textContent).toContain("Docs ready");
    expect(container.textContent).toContain("2 docs");
    expect(container.textContent).toContain("active session sess-active");
    expect(container.textContent).toContain("Summary: 1");
    expect(container.textContent).toContain("Spec: 1");
    expect(container.querySelector(".deck-ui-docs")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-docs-card")).toHaveLength(2);
    expect(container.querySelectorAll(".deck-ui-docs-stats .deckgo-stat")).toHaveLength(2);
    expect(container.querySelector(".deck-ui-docs-category-filter")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-docs-row")).toHaveLength(2);
    expect(container.querySelector('[data-category-filter="summary"]')?.textContent).toContain("1");
    expect(container.textContent).toContain("summary");
    expect(container.textContent).toContain("project");
    expect(container.textContent).toContain("Source session");
    expect(container.textContent).toContain("sess-main");
    expect(container.textContent).toContain("Source agent");
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("Open source session");
    expect(container.textContent).toContain("Open source agent");
    expect(container.textContent).toContain("Project Summary");
    await waitFor(() => expect(apiMocks.fetchDoc).toHaveBeenCalledWith("doc-summary"));
    expect(container.textContent).toContain("Summary content from detail route");
    expect(container.querySelector(".deck-ui-docs-hero")).toBeTruthy();
    expect(container.querySelectorAll(".deck-ui-docs-surface")).toHaveLength(5);
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelector('[data-markdown-mode="static"] h2')?.textContent).toBe(
      "Detail Heading",
    );

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

    const selectedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.className.includes("is-selected"),
    );
    expect(selectedButton?.textContent).toContain("Project Summary");
  });

  it("refreshes filters and runs extract and delete actions for the selected doc", async () => {
    renderPanel();

    await waitFor(() => expect(apiMocks.fetchDocs).toHaveBeenCalledTimes(1));

    const queryInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search docs..."]',
    );
    expect(queryInput).toBeTruthy();
    const specFilter = container.querySelector<HTMLButtonElement>('[data-category-filter="spec"]');
    expect(specFilter).toBeTruthy();

    await act(async () => {
      specFilter?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fireEvent.change(queryInput as HTMLInputElement, { target: { value: "api" } });
    });

    expect(apiMocks.fetchDocs).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-category-filter="summary"]')?.textContent).toContain("1");
    expect(container.querySelector('[data-doc-id="doc-summary"]')).toBeNull();
    expect(container.querySelector('[data-doc-id="doc-api"]')).toBeTruthy();

    const apiDocButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("API Spec"),
    );
    expect(apiDocButton).toBeTruthy();

    await act(async () => {
      apiDocButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.fetchDoc).toHaveBeenCalledWith("doc-api"));
    expect(container.textContent).toContain("API details from detail route");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Extract active session")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(apiMocks.extractDocs).toHaveBeenCalledWith("sess-active"));
    expect(container.textContent).toContain("Last docs action");
    expect(container.textContent).not.toContain("Extract all");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(apiMocks.deleteDoc).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Confirm delete");
    expect(container.textContent).toContain("Cancel delete");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Cancel delete")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Confirm delete");

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

  it("renders the migrated docs shell in Chinese", async () => {
    renderPanel("zh");

    await waitFor(() => expect(apiMocks.fetchDocs).toHaveBeenCalledWith());

    expect(container.textContent).toContain("文档就绪");
    expect(container.textContent).toContain("2 份文档");
    expect(container.textContent).toContain("活跃 session sess-active");
    expect(container.textContent).toContain("文档中心");
    expect(container.textContent).toContain("当前文档");
  });
});
