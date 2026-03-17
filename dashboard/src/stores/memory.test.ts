import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryStore } from "./memory.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("memory store", () => {
  beforeEach(() => {
    useMemoryStore.setState({
      agents: [],
      selectedAgentId: null,
      selectedScope: "all",
      files: [],
      selectedFileContent: null,
      selectedFilePath: null,
      searchResults: [],
      healthStatus: [],
      isLanceDbEnabled: false,
      loading: false,
      error: null,
      activeTab: "files",
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("scope filter state", () => {
    it("should default selectedScope to 'all'", () => {
      expect(useMemoryStore.getState().selectedScope).toBe("all");
    });

    it("should update selectedScope via setSelectedScope", () => {
      useMemoryStore.getState().setSelectedScope("global");
      expect(useMemoryStore.getState().selectedScope).toBe("global");

      useMemoryStore.getState().setSelectedScope("agent");
      expect(useMemoryStore.getState().selectedScope).toBe("agent");

      useMemoryStore.getState().setSelectedScope("all");
      expect(useMemoryStore.getState().selectedScope).toBe("all");
    });
  });

  describe("searchMemory with scope", () => {
    it("should pass scope parameter when not 'all'", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await useMemoryStore.getState().searchMemory("test query", "agent-1", "global");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("q=test+query");
      expect(url).toContain("agentId=agent-1");
      expect(url).toContain("scope=global");
    });

    it("should omit scope parameter when 'all'", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await useMemoryStore.getState().searchMemory("test query", "agent-1", "all");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("q=test+query");
      expect(url).not.toContain("scope=");
    });

    it("should store results with tier and decayScore metadata", async () => {
      const results = [
        { path: "mem/1.md", content: "fact", relevance: 0.95, tier: "core", decayScore: 0.88 },
        { path: "mem/2.md", content: "data", relevance: 0.7, tier: "peripheral" },
        { path: "mem/3.md", content: "note", relevance: 0.5 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results }),
      });

      await useMemoryStore.getState().searchMemory("test");

      const stored = useMemoryStore.getState().searchResults;
      expect(stored).toHaveLength(3);
      expect(stored[0].tier).toBe("core");
      expect(stored[0].decayScore).toBe(0.88);
      expect(stored[1].tier).toBe("peripheral");
      expect(stored[1].decayScore).toBeUndefined();
      expect(stored[2].tier).toBeUndefined();
    });
  });

  describe("fetchAgents", () => {
    it("should fetch and store agents on success", async () => {
      const agents = [
        { id: "a1", name: "Agent 1" },
        { id: "a2", name: "Agent 2" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => agents,
      });

      await useMemoryStore.getState().fetchAgents();

      expect(mockFetch).toHaveBeenCalledWith("/api/agents");
      expect(useMemoryStore.getState().agents).toEqual(agents);
    });

    it("should handle agents response with nested array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agents: [{ id: "a1" }] }),
      });

      await useMemoryStore.getState().fetchAgents();

      expect(useMemoryStore.getState().agents).toEqual([{ id: "a1", name: "a1" }]);
    });
  });

  describe("browseFiles", () => {
    it("should fetch and store files", async () => {
      const files = [{ name: "test.md", path: "test.md", type: "file", size: 100 }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files }),
      });

      await useMemoryStore.getState().browseFiles("agent-1");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("agentId=agent-1");
      expect(useMemoryStore.getState().files).toEqual(files);
    });

    it("should set error on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Not found" }),
      });

      await useMemoryStore.getState().browseFiles("agent-1");

      expect(useMemoryStore.getState().error).toBe("Not found");
      expect(useMemoryStore.getState().loading).toBe(false);
    });
  });
});
