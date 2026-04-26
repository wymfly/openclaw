// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandRegistry } from "@/lib/command-registry";
import type { DeckStreamOptions } from "@/lib/deck-client";
import { useChatStore } from "@/stores/chat";
import { useCommandDiscovery } from "./use-command-discovery";

const deckClient = vi.hoisted(() => ({
  deckFetch: vi.fn(),
  deckStream: vi.fn(),
}));

vi.mock("@/lib/deck-client", () => deckClient);

let container: HTMLDivElement;
let root: Root | null = null;

function Harness() {
  useCommandDiscovery();
  return null;
}

function renderHarness() {
  act(() => {
    root = createRoot(container);
    root.render(createElement(Harness));
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

describe("useCommandDiscovery", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    unregisterDiscoveredCommands();
    useChatStore.setState({ activeAgentId: "main" });
    deckClient.deckFetch.mockReset();
    deckClient.deckStream.mockReset();
    deckClient.deckStream.mockImplementation((_path: string, options: DeckStreamOptions) => {
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
    deckClient.deckFetch.mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          version: "v1",
          commands: [
            {
              name: "deploy",
              source: "builtin",
              description: "Deploy target",
              args: "<target>",
              argChoices: ["staging", "prod"],
              category: "tools",
            },
          ],
        }),
        { status: 200 },
      );
    });

    renderHarness();

    await waitFor(() => {
      expect(commandRegistry.get("deploy")).toMatchObject({
        source: "builtin",
        execMode: "remote",
        argOptions: ["staging", "prod"],
        category: "tools",
      });
    });
    expect(deckClient.deckFetch).toHaveBeenCalledWith(
      "/api/deck/commands/discover",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ agentId: "main" }),
      }),
    );
    expect(deckClient.deckStream).toHaveBeenCalledWith(
      "/api/stream",
      expect.objectContaining({ reconnect: true }),
    );

    cleanupHarness();

    expect(commandRegistry.get("deploy")).toBeUndefined();
  });

  it("refreshes discovered commands when the Gateway reports commands.changed", async () => {
    let streamOptions: DeckStreamOptions | undefined;
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
    deckClient.deckFetch.mockImplementation(async () => {
      return new Response(JSON.stringify(payloads.shift() ?? payloads[0]), { status: 200 });
    });
    deckClient.deckStream.mockImplementation((_path: string, options: DeckStreamOptions) => {
      streamOptions = options;
      return new Promise<void>((resolve) => {
        options.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    renderHarness();

    await waitFor(() => {
      expect(deckClient.deckFetch).toHaveBeenCalledTimes(1);
    });
    act(() => {
      streamOptions?.onEvent?.({ event: "commands.changed" });
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
