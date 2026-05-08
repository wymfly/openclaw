// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricTestProvider } from "@/data/testing/DataFabricTestProvider";
import { commandRegistry } from "@/lib/command-registry";
import { useChatStore } from "@/stores/chat";
import { useCommandDiscovery } from "./use-command-discovery";

const apiMocks = vi.hoisted(() => ({
  fetchCommandDiscovery: vi.fn(),
  streamEvents: vi.fn(),
  streamLogEvents: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);
vi.mock("../api", () => apiMocks);

let container: HTMLDivElement;
let root: Root | null = null;

function Harness() {
  useCommandDiscovery();
  return null;
}

function renderHarness() {
  act(() => {
    root = createRoot(container);
    root.render(createElement(DataFabricTestProvider, null, createElement(Harness)));
  });
}

function cleanupHarness() {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
}

function unregisterDiscoveredCommands() {
  commandRegistry.unregisterBySource("builtin");
  commandRegistry.unregisterBySource("skill");
  commandRegistry.unregisterBySource("plugin");
}

type CapturedStreamParams = {
  onEvent?: (event: { event?: string; projection?: string; projectionId?: string }) => void;
  signal?: AbortSignal;
};

describe("useCommandDiscovery", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    unregisterDiscoveredCommands();
    useChatStore.setState({ activeAgentId: "main" });
    apiMocks.fetchCommandDiscovery.mockReset();
    apiMocks.streamEvents.mockReset();
    apiMocks.streamLogEvents.mockReset();
    apiMocks.streamEvents.mockImplementation((options: CapturedStreamParams) => {
      return new Promise<void>((resolve) => {
        options.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });
  });

  afterEach(() => {
    cleanupHarness();
    container.remove();
    unregisterDiscoveredCommands();
    vi.restoreAllMocks();
  });

  it("registers discovered Gateway commands and cleans them up on unmount", async () => {
    apiMocks.fetchCommandDiscovery.mockResolvedValue({
      version: "v1",
      commands: [
        {
          name: "deploy",
          aliases: ["ship"],
          source: "builtin",
          description: "Deploy target",
          args: "<target>",
          argChoices: ["staging", "prod"],
          category: "tools",
        },
      ],
    });

    renderHarness();

    await waitFor(() => {
      expect(commandRegistry.get("deploy")).toMatchObject({
        source: "builtin",
        execMode: "remote",
        aliases: ["ship"],
        argOptions: ["staging", "prod"],
        category: "tools",
      });
    });
    expect(apiMocks.fetchCommandDiscovery).toHaveBeenCalledWith("main");
    expect(apiMocks.streamEvents).toHaveBeenCalledTimes(1);

    cleanupHarness();

    expect(commandRegistry.get("deploy")).toBeUndefined();
  });

  it("refreshes discovered commands when the Gateway reports commands.changed", async () => {
    let streamOptions: CapturedStreamParams | undefined;
    const payloads = [
      { version: "v1", commands: [] },
      {
        version: "v2",
        commands: [
          {
            name: "summarize",
            source: "skill",
            description: "Summarize context",
          },
        ],
      },
    ];
    let latestPayload = payloads[0];
    apiMocks.fetchCommandDiscovery.mockImplementation(async () => {
      latestPayload = payloads.shift() ?? latestPayload;
      return latestPayload;
    });
    apiMocks.streamEvents.mockImplementation((options: CapturedStreamParams) => {
      streamOptions = options;
      return new Promise<void>((resolve) => {
        options.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    renderHarness();

    await waitFor(() => {
      expect(apiMocks.fetchCommandDiscovery).toHaveBeenCalledTimes(1);
    });
    act(() => {
      streamOptions?.onEvent?.({ event: "commands.changed", projectionId: "command-discovery" });
    });

    await waitFor(() => {
      expect(commandRegistry.get("summarize")).toMatchObject({
        source: "skill",
        execMode: "remote",
        category: "skills",
      });
    });
  });
});
