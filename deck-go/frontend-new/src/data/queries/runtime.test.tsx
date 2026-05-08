// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDataFabricQueryClient } from "../client/query-client";
import { DataFabricTestProvider } from "../testing/DataFabricTestProvider";
import { executeBffQuerySource } from "../transport/bff";
import {
  fetchRuntimeSummaryWithDataFabric,
  runtimeBootstrapQueryOptions,
  useRuntimeBootstrapQuery,
} from "./runtime";

const apiMocks = vi.hoisted(() => ({
  fetchBootstrapStatus: vi.fn(),
  fetchRuntimeGatewayStatus: vi.fn(),
}));

vi.mock("../../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function RuntimeBootstrapProbe() {
  const query = useRuntimeBootstrapQuery();
  return createElement("span", { "data-testid": "bootstrap" }, query.data?.ok ? "ready" : "idle");
}

describe("runtime Data Fabric queries", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    apiMocks.fetchBootstrapStatus.mockResolvedValue({ ok: true, runtime: { status: "running" } });
    apiMocks.fetchRuntimeGatewayStatus.mockResolvedValue({
      ok: true,
      runtime: { status: "running" },
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
  });

  it("reads runtime bootstrap through the BFF-backed source and caches fresh data", async () => {
    const client = createDataFabricQueryClient();

    await client.fetchQuery(runtimeBootstrapQueryOptions(executeBffQuerySource));
    await client.fetchQuery(runtimeBootstrapQueryOptions(executeBffQuerySource));

    expect(apiMocks.fetchBootstrapStatus).toHaveBeenCalledTimes(1);
  });

  it("force refresh invalidates both runtime summary queries", async () => {
    const client = createDataFabricQueryClient();

    await fetchRuntimeSummaryWithDataFabric(client, executeBffQuerySource);
    await fetchRuntimeSummaryWithDataFabric(client, executeBffQuerySource, { force: true });

    expect(apiMocks.fetchBootstrapStatus).toHaveBeenCalledTimes(2);
    expect(apiMocks.fetchRuntimeGatewayStatus).toHaveBeenCalledTimes(2);
  });

  it("hook tests can mount with DataFabricTestProvider and recorded BFF calls", async () => {
    const calls: Array<{ kind: "bff" | "gateway-rpc"; path?: string; method?: string }> = [];

    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(DataFabricTestProvider, { calls }, createElement(RuntimeBootstrapProbe)),
      );
    });

    await waitFor(() => {
      expect(container.textContent).toContain("ready");
    });
    expect(calls).toContainEqual({ kind: "bff", path: "/bootstrap/status" });
  });
});
