"use client";

import { useEffect, useRef, useCallback } from "react";
import { commandRegistry } from "@/lib/command-registry";
import { SOURCE_PRIORITY } from "@/lib/command-types";
import type { RegisteredCommand } from "@/lib/command-types";
import { useChatStore } from "@/stores/chat";
import type { DeckCommandsDiscoverResult } from "@/types/gateway-protocol.generated";

/**
 * Discovers available commands from Gateway via deck.commands.discover RPC.
 * Re-discovers when active agent changes or SSE `commands.changed` fires.
 * Subscribes to the existing SSE stream instead of opening a new connection.
 */
export function useCommandDiscovery() {
  const versionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const activeAgentId = useChatStore((s) => s.activeAgentId);

  const discover = useCallback(async (agentId: string | undefined) => {
    try {
      const res = await fetch("/api/deck/commands/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentId ? { agentId } : {}),
      });
      if (!res.ok) {
        console.warn(`[useCommandDiscovery] Discovery failed: HTTP ${res.status}`);
        return;
      }
      if (!mountedRef.current) return;
      const data = (await res.json()) as DeckCommandsDiscoverResult;

      if (!mountedRef.current) return;

      const newVersion = data.version ?? "";
      if (newVersion === versionRef.current) return;
      versionRef.current = newVersion;

      // Clear previous remote commands
      commandRegistry.unregisterBySource("builtin");
      commandRegistry.unregisterBySource("skill");
      commandRegistry.unregisterBySource("plugin");

      // Register discovered commands
      for (const cmd of data.commands) {
        const source = cmd.source as RegisteredCommand["source"];
        const registered: RegisteredCommand = {
          name: cmd.name,
          source,
          execMode: "remote",
          description: cmd.description,
          args: cmd.args,
          argOptions: cmd.argChoices,
          category: cmd.category ?? (source === "skill" ? "skills" : "more"),
          priority: SOURCE_PRIORITY[source],
          skillName: cmd.skillName,
          pluginId: cmd.pluginId,
        };
        commandRegistry.register(registered);
      }
    } catch (err) {
      // Local commands remain available as fallback
      console.warn("[useCommandDiscovery] Failed to discover commands:", err);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Reset version on agent change to force re-discover
    versionRef.current = null;
    discover(activeAgentId ?? undefined);

    // Listen for SSE commands.changed events
    const es = new EventSource("/api/stream");
    const onChanged = () => discover(activeAgentId ?? undefined);
    es.addEventListener("commands.changed", onChanged);
    es.onerror = () => {
      console.warn("[useCommandDiscovery] SSE connection error — command updates may be delayed");
    };

    return () => {
      mountedRef.current = false;
      es.removeEventListener("commands.changed", onChanged);
      es.close();
      // Clean up remote commands
      commandRegistry.unregisterBySource("builtin");
      commandRegistry.unregisterBySource("skill");
      commandRegistry.unregisterBySource("plugin");
    };
  }, [activeAgentId, discover]);
}
