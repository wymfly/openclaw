import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocCategory = "summary" | "plan" | "spec" | "manual" | "draft";

export interface Doc {
  id: string;
  title: string;
  category: DocCategory;
  content: string;
  sourceSession: string | null;
  sourceAgent: string | null;
  keywords: string[];
  language: string;
  extractedAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface DocsState {
  docs: Doc[];
  selectedDoc: Doc | null;
  filterCategory: DocCategory | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;

  fetchDocs: () => Promise<void>;
  selectDoc: (doc: Doc | null) => void;
  setFilterCategory: (category: DocCategory | null) => void;
  setSearchQuery: (query: string) => void;
  extractDocs: (sessionKey?: string) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
}

export const useDocsStore = create<DocsState>((set, get) => ({
  docs: [],
  selectedDoc: null,
  filterCategory: null,
  searchQuery: "",
  loading: false,
  error: null,

  fetchDocs: async () => {
    set({ loading: true, error: null });
    const { filterCategory, searchQuery } = get();
    const params = new URLSearchParams();
    if (filterCategory) {
      params.set("category", filterCategory);
    }
    if (searchQuery) {
      params.set("q", searchQuery);
    }
    const qs = params.toString();
    const url = qs ? `/api/docs?${qs}` : "/api/docs";
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error ?? "Failed to fetch docs", loading: false });
        return;
      }
      const data = await res.json();
      set({ docs: data.docs ?? [], loading: false });
    } catch {
      set({ error: "Network error", loading: false });
    }
  },

  selectDoc: (doc) => {
    set({ selectedDoc: doc });
  },

  setFilterCategory: (category) => {
    set({ filterCategory: category });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  extractDocs: async (sessionKey?: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/docs/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error ?? "Extraction failed", loading: false });
        return;
      }
      // Refresh list after extraction
      set({ loading: false });
      await get().fetchDocs();
    } catch {
      set({ error: "Network error", loading: false });
    }
  },

  deleteDoc: async (id: string) => {
    try {
      const res = await fetch(`/api/docs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        set({ error: data.error ?? "Delete failed" });
        return;
      }
      const { docs, selectedDoc } = get();
      set({
        docs: docs.filter((d) => d.id !== id),
        selectedDoc: selectedDoc?.id === id ? null : selectedDoc,
      });
    } catch {
      set({ error: "Network error" });
    }
  },
}));
