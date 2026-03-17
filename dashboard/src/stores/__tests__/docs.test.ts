import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useDocsStore } from "../docs";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  useDocsStore.setState({
    docs: [],
    selectedDoc: null,
    filterCategory: null,
    searchQuery: "",
    loading: false,
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// fetchDocs
// ---------------------------------------------------------------------------

describe("fetchDocs", () => {
  it("fetches docs and updates state", async () => {
    const mockDocs = [
      {
        id: "doc-1",
        title: "Test Doc",
        category: "plan",
        content: "# Plan\n\nContent",
        sourceSession: null,
        sourceAgent: null,
        keywords: ["plan"],
        language: "en",
        extractedAt: "2026-03-17T00:00:00",
        updatedAt: "2026-03-17T00:00:00",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ docs: mockDocs }),
    });

    await useDocsStore.getState().fetchDocs();

    const state = useDocsStore.getState();
    expect(state.docs).toEqual(mockDocs);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("passes category filter as query param", async () => {
    useDocsStore.setState({ filterCategory: "plan" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ docs: [] }),
    });

    await useDocsStore.getState().fetchDocs();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("category=plan");
  });

  it("passes search query as query param", async () => {
    useDocsStore.setState({ searchQuery: "test" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ docs: [] }),
    });

    await useDocsStore.getState().fetchDocs();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("q=test");
  });

  it("sets error on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });

    await useDocsStore.getState().fetchDocs();

    const state = useDocsStore.getState();
    expect(state.error).toBe("Server error");
    expect(state.loading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractDocs
// ---------------------------------------------------------------------------

describe("extractDocs", () => {
  it("calls extract endpoint and refreshes docs list", async () => {
    // First call: extract
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ extracted: 2, docs: [] }),
    });
    // Second call: fetchDocs refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ docs: [{ id: "doc-1", title: "Extracted" }] }),
    });

    await useDocsStore.getState().extractDocs();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe("/api/docs/extract");
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("passes sessionKey in body when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ extracted: 0, docs: [] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ docs: [] }),
    });

    await useDocsStore.getState().extractDocs("session-abc");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sessionKey).toBe("session-abc");
  });

  it("sets error on extract failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Extraction failed" }),
    });

    await useDocsStore.getState().extractDocs();

    expect(useDocsStore.getState().error).toBe("Extraction failed");
  });
});

// ---------------------------------------------------------------------------
// deleteDoc
// ---------------------------------------------------------------------------

describe("deleteDoc", () => {
  it("calls delete endpoint and removes doc from state", async () => {
    useDocsStore.setState({
      docs: [
        {
          id: "doc-1",
          title: "A",
          category: "plan",
          content: "",
          sourceSession: null,
          sourceAgent: null,
          keywords: [],
          language: "en",
          extractedAt: "",
          updatedAt: "",
        },
        {
          id: "doc-2",
          title: "B",
          category: "draft",
          content: "",
          sourceSession: null,
          sourceAgent: null,
          keywords: [],
          language: "en",
          extractedAt: "",
          updatedAt: "",
        },
      ],
      selectedDoc: {
        id: "doc-1",
        title: "A",
        category: "plan",
        content: "",
        sourceSession: null,
        sourceAgent: null,
        keywords: [],
        language: "en",
        extractedAt: "",
        updatedAt: "",
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await useDocsStore.getState().deleteDoc("doc-1");

    const state = useDocsStore.getState();
    expect(state.docs).toHaveLength(1);
    expect(state.docs[0].id).toBe("doc-2");
    expect(state.selectedDoc).toBeNull();
  });

  it("clears selectedDoc only if the deleted doc was selected", async () => {
    useDocsStore.setState({
      docs: [
        {
          id: "doc-1",
          title: "A",
          category: "plan",
          content: "",
          sourceSession: null,
          sourceAgent: null,
          keywords: [],
          language: "en",
          extractedAt: "",
          updatedAt: "",
        },
        {
          id: "doc-2",
          title: "B",
          category: "draft",
          content: "",
          sourceSession: null,
          sourceAgent: null,
          keywords: [],
          language: "en",
          extractedAt: "",
          updatedAt: "",
        },
      ],
      selectedDoc: {
        id: "doc-2",
        title: "B",
        category: "draft",
        content: "",
        sourceSession: null,
        sourceAgent: null,
        keywords: [],
        language: "en",
        extractedAt: "",
        updatedAt: "",
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await useDocsStore.getState().deleteDoc("doc-1");

    // selectedDoc should remain doc-2 since we deleted doc-1
    expect(useDocsStore.getState().selectedDoc?.id).toBe("doc-2");
  });

  it("sets error on delete failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Delete failed" }),
    });

    await useDocsStore.getState().deleteDoc("doc-1");

    expect(useDocsStore.getState().error).toBe("Delete failed");
  });
});

// ---------------------------------------------------------------------------
// Synchronous state helpers
// ---------------------------------------------------------------------------

describe("synchronous state helpers", () => {
  it("selectDoc sets selectedDoc", () => {
    const doc = {
      id: "doc-1",
      title: "Test",
      category: "plan" as const,
      content: "",
      sourceSession: null,
      sourceAgent: null,
      keywords: [],
      language: "en",
      extractedAt: "",
      updatedAt: "",
    };

    useDocsStore.getState().selectDoc(doc);
    expect(useDocsStore.getState().selectedDoc).toEqual(doc);

    useDocsStore.getState().selectDoc(null);
    expect(useDocsStore.getState().selectedDoc).toBeNull();
  });

  it("setFilterCategory updates filterCategory", () => {
    useDocsStore.getState().setFilterCategory("spec");
    expect(useDocsStore.getState().filterCategory).toBe("spec");

    useDocsStore.getState().setFilterCategory(null);
    expect(useDocsStore.getState().filterCategory).toBeNull();
  });

  it("setSearchQuery updates searchQuery", () => {
    useDocsStore.getState().setSearchQuery("hello");
    expect(useDocsStore.getState().searchQuery).toBe("hello");
  });
});
