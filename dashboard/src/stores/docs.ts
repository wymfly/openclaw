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
  extractDocs: () => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
}

export const useDocsStore = create<DocsState>((set) => ({
  docs: [],
  selectedDoc: null,
  filterCategory: null,
  searchQuery: "",
  loading: false,
  error: null,

  fetchDocs: async () => {
    /* T2 */
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

  extractDocs: async () => {
    /* T2 */
  },

  deleteDoc: async (_id) => {
    /* T2 */
  },
}));
