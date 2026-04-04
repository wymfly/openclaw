import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useApprovalsStore } from "../approvals";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  mockFetch.mockReset();
  // Reset store state
  useApprovalsStore.setState({
    pending: [],
    policy: null,
    policyHash: null,
    loading: false,
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// fetchPolicy
// ---------------------------------------------------------------------------

describe("fetchPolicy", () => {
  it("fetches and sets policy from gateway response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hash: "abc123",
        file: {
          defaults: { security: "deny", ask: "always" },
          agents: { "agent-1": { security: "full" } },
          allowlist: ["/usr/bin"],
        },
      }),
    });

    await useApprovalsStore.getState().fetchPolicy();

    const state = useApprovalsStore.getState();
    expect(state.policy).toEqual({
      defaults: { security: "deny", ask: "always" },
      agents: { "agent-1": { security: "full" } },
      allowlist: ["/usr/bin"],
    });
    expect(state.policyHash).toBe("abc123");
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Gateway not configured" }),
    });

    await useApprovalsStore.getState().fetchPolicy();

    const state = useApprovalsStore.getState();
    expect(state.error).toBe("Gateway not configured");
    expect(state.loading).toBe(false);
  });

  it("handles empty file gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: "empty", file: {} }),
    });

    await useApprovalsStore.getState().fetchPolicy();

    const state = useApprovalsStore.getState();
    expect(state.policy).toEqual({
      defaults: {},
      agents: {},
      allowlist: [],
    });
  });
});

// ---------------------------------------------------------------------------
// fetchPending
// ---------------------------------------------------------------------------

describe("fetchPending", () => {
  it("fetches and sets pending approvals", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pending: [
          {
            id: "p1",
            command: "ls",
            createdAtMs: Date.now() - 1_000,
            expiresAtMs: Date.now() + 60_000,
          },
        ],
      }),
    });

    await useApprovalsStore.getState().fetchPending();

    expect(useApprovalsStore.getState().pending).toHaveLength(1);
    expect(useApprovalsStore.getState().pending[0].id).toBe("p1");
  });

  it("sets empty array on error (best-effort)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    await useApprovalsStore.getState().fetchPending();

    // Should not throw, pending stays unchanged
    expect(useApprovalsStore.getState().pending).toEqual([]);
  });

  it("filters expired approvals from the fetched pending list", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T00:00:00.000Z"));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pending: [
          {
            id: "expired",
            command: "rm -rf /tmp/old",
            createdAtMs: Date.now() - 10_000,
            expiresAtMs: Date.now() - 1_000,
          },
          {
            id: "active",
            command: "echo ok",
            createdAtMs: Date.now() - 5_000,
            expiresAtMs: Date.now() + 60_000,
          },
        ],
      }),
    });

    await useApprovalsStore.getState().fetchPending();

    expect(useApprovalsStore.getState().pending).toEqual([
      expect.objectContaining({ id: "active" }),
    ]);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// resolveApproval
// ---------------------------------------------------------------------------

describe("resolveApproval", () => {
  it("sends resolve request and removes from pending", async () => {
    useApprovalsStore.setState({
      pending: [
        {
          id: "p1",
          command: "ls",
          createdAtMs: Date.now() - 1_000,
          expiresAtMs: Date.now() + 60_000,
        },
        {
          id: "p2",
          command: "cat",
          createdAtMs: Date.now() - 1_000,
          expiresAtMs: Date.now() + 60_000,
        },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const result = await useApprovalsStore.getState().resolveApproval("p1", "allow-once");

    expect(result).toBe(true);
    expect(useApprovalsStore.getState().pending).toHaveLength(1);
    expect(useApprovalsStore.getState().pending[0].id).toBe("p2");

    // Verify fetch was called with correct params
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/approvals",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "p1", decision: "allow-once" }),
      }),
    );

    const headers = mockFetch.mock.calls[0][1].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await useApprovalsStore.getState().resolveApproval("p1", "deny");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updatePolicy
// ---------------------------------------------------------------------------

describe("updatePolicy", () => {
  it("sends policy update with baseHash", async () => {
    useApprovalsStore.setState({ policyHash: "hash-1" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hash: "hash-2" }),
    });

    const newPolicy = {
      defaults: { security: "full" as const },
      agents: {},
      allowlist: ["/usr/local"],
    };

    const result = await useApprovalsStore.getState().updatePolicy(newPolicy);

    expect(result).toBe(true);
    expect(useApprovalsStore.getState().policyHash).toBe("hash-2");

    // Verify request body — allowlist must NOT be sent at the file top level
    // because ExecApprovalsFileSchema has additionalProperties: false.
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.baseHash).toBe("hash-1");
    expect(callBody.file.defaults.security).toBe("full");
    expect(callBody.file).not.toHaveProperty("allowlist");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await useApprovalsStore.getState().updatePolicy({
      defaults: {},
      agents: {},
      allowlist: [],
    });
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addPending / removePending
// ---------------------------------------------------------------------------

describe("addPending / removePending", () => {
  it("adds a pending approval", () => {
    useApprovalsStore.getState().addPending({
      id: "p1",
      command: "ls",
      createdAtMs: Date.now() - 1_000,
      expiresAtMs: Date.now() + 60_000,
    });

    expect(useApprovalsStore.getState().pending).toHaveLength(1);
  });

  it("does not add duplicate pending approval", () => {
    const approval = {
      id: "p1",
      command: "ls",
      createdAtMs: Date.now() - 1_000,
      expiresAtMs: Date.now() + 60_000,
    };

    useApprovalsStore.getState().addPending(approval);
    useApprovalsStore.getState().addPending(approval);

    expect(useApprovalsStore.getState().pending).toHaveLength(1);
  });

  it("does not add an already expired pending approval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T00:00:00.000Z"));
    useApprovalsStore.getState().addPending({
      id: "expired",
      command: "ls",
      createdAtMs: Date.now() - 10_000,
      expiresAtMs: Date.now() - 1_000,
    });

    expect(useApprovalsStore.getState().pending).toEqual([]);
    vi.useRealTimers();
  });

  it("removes a pending approval by id", () => {
    useApprovalsStore.setState({
      pending: [
        {
          id: "p1",
          command: "ls",
          createdAtMs: Date.now() - 1_000,
          expiresAtMs: Date.now() + 60_000,
        },
        {
          id: "p2",
          command: "cat",
          createdAtMs: Date.now() - 1_000,
          expiresAtMs: Date.now() + 60_000,
        },
      ],
    });

    useApprovalsStore.getState().removePending("p1");

    expect(useApprovalsStore.getState().pending).toHaveLength(1);
    expect(useApprovalsStore.getState().pending[0].id).toBe("p2");
  });
});
