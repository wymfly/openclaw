import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryTab = "files" | "search" | "graph" | "health";

export interface MemoryFileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: MemoryFileNode[];
}

export interface MemorySearchResult {
  path: string;
  content: string;
  relevance: number;
}

export interface MemoryHealthEntry {
  agentId: string;
  provider: string;
  embeddingStatus: "ok" | "error" | "unknown";
  error?: string;
}

export interface MemoryAgent {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface MemoryState {
  agents: MemoryAgent[];
  selectedAgentId: string | null;
  files: MemoryFileNode[];
  selectedFileContent: string | null;
  selectedFilePath: string | null;
  searchResults: MemorySearchResult[];
  healthStatus: MemoryHealthEntry[];
  isLanceDbEnabled: boolean;
  loading: boolean;
  error: string | null;
  activeTab: MemoryTab;

  setActiveTab: (tab: MemoryTab) => void;
  setSelectedAgent: (agentId: string | null) => void;
  setFiles: (files: MemoryFileNode[]) => void;
  setSelectedFile: (path: string | null, content: string | null) => void;
  setSearchResults: (results: MemorySearchResult[]) => void;
  setHealthStatus: (status: MemoryHealthEntry[]) => void;
  setLanceDbEnabled: (enabled: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  fetchAgents: () => Promise<void>;
  browseFiles: (agentId: string, path?: string) => Promise<void>;
  readFile: (agentId: string, path: string) => Promise<void>;
  searchMemory: (query: string, agentId?: string) => Promise<void>;
  fetchHealth: () => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set, _get) => ({
  agents: [],
  selectedAgentId: null,
  files: [],
  selectedFileContent: null,
  selectedFilePath: null,
  searchResults: [],
  healthStatus: [],
  isLanceDbEnabled: false,
  loading: false,
  error: null,
  activeTab: "files",

  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedAgent: (selectedAgentId) => set({ selectedAgentId }),
  setFiles: (files) => set({ files }),
  setSelectedFile: (path, content) => set({ selectedFilePath: path, selectedFileContent: content }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setHealthStatus: (healthStatus) => set({ healthStatus }),
  setLanceDbEnabled: (isLanceDbEnabled) => set({ isLanceDbEnabled }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchAgents: async () => {
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.agents) ? data.agents : [];
      const agents: MemoryAgent[] = list.map((a: { id: string; name?: string }) => ({
        id: a.id,
        name: a.name ?? a.id,
      }));
      set({ agents });
    } catch {
      // Silently ignore — agents list is non-critical.
    }
  },

  browseFiles: async (agentId: string, path?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ agentId });
      if (path) {
        params.set("path", path);
      }
      const res = await fetch(`/api/memory/browse?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ error: (body as { error?: string }).error ?? "Failed to browse files" });
        return;
      }
      const data = (await res.json()) as { files?: MemoryFileNode[] };
      set({ files: data.files ?? [] });
    } catch {
      set({ error: "Failed to browse memory files" });
    } finally {
      set({ loading: false });
    }
  },

  readFile: async (agentId: string, path: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ agentId, path });
      const res = await fetch(`/api/memory/browse?${params}&read=1`);
      if (!res.ok) {
        set({ error: "Failed to read file" });
        return;
      }
      const data = (await res.json()) as { content?: string };
      set({ selectedFilePath: path, selectedFileContent: data.content ?? "" });
    } catch {
      set({ error: "Failed to read file" });
    } finally {
      set({ loading: false });
    }
  },

  searchMemory: async (query: string, agentId?: string) => {
    set({ loading: true, error: null, searchResults: [] });
    try {
      const params = new URLSearchParams({ q: query });
      if (agentId) {
        params.set("agentId", agentId);
      }
      const res = await fetch(`/api/memory/search?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({
          error: (body as { error?: string }).error ?? "Search failed",
          isLanceDbEnabled: false,
        });
        return;
      }
      const data = (await res.json()) as { results?: MemorySearchResult[] };
      set({ searchResults: data.results ?? [], isLanceDbEnabled: true });
    } catch {
      set({ error: "Search failed" });
    } finally {
      set({ loading: false });
    }
  },

  fetchHealth: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/memory/health");
      if (!res.ok) {
        set({ error: "Failed to fetch health status" });
        return;
      }
      const data = (await res.json()) as {
        entries?: MemoryHealthEntry[];
        lanceDbEnabled?: boolean;
      };
      set({
        healthStatus: data.entries ?? [],
        isLanceDbEnabled: data.lanceDbEnabled ?? false,
      });
    } catch {
      set({ error: "Failed to fetch health" });
    } finally {
      set({ loading: false });
    }
  },
}));
