import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let useNodesStore: typeof import("../nodes").useNodesStore;

beforeEach(async () => {
  vi.resetModules();
  ({ useNodesStore } = await import("../nodes"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("nodes store", () => {
  it("refreshes selected node detail after approving a pairing request", async () => {
    const fetchMock = vi.fn<
      typeof fetch
    >()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        Response.json({
          nodes: [
            {
              nodeId: "node-1",
              displayName: "Primary Node",
              platform: "ios",
              caps: [],
              commands: [],
              paired: true,
              connected: false,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ pending: [] }))
      .mockResolvedValueOnce(
        Response.json({
          nodeId: "node-1",
          displayName: "Primary Node",
          platform: "ios",
          remoteIp: "10.0.0.2",
          caps: [],
          commands: [],
          paired: true,
          connected: true,
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    useNodesStore.setState({
      nodes: [],
      nodeDetails: {},
      pairingRequests: [],
      selectedNodeId: "node-1",
      describingNodeId: null,
      loading: false,
      error: null,
    });

    const ok = await useNodesStore.getState().approvePairing("req-1");

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(useNodesStore.getState().nodeDetails["node-1"]?.remoteIp).toBe("10.0.0.2");
  });
});
