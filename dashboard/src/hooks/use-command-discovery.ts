"use client";

import { useCallback, useEffect, useRef } from "react";
import { commandRegistry } from "@/lib/command-registry";
import { SOURCE_PRIORITY } from "@/lib/command-types";
import type { RegisteredCommand } from "@/lib/command-types";
import { useChatStore } from "@/stores/chat";
import type { DeckCommandsDiscoverResult } from "@/types/gateway-protocol.generated";

const DISCOVERED_SOURCES: RegisteredCommand["source"][] = ["builtin", "skill", "plugin"];

function unregisterDiscoveredCommands(): void {
  for (const source of DISCOVERED_SOURCES) {
    commandRegistry.unregisterBySource(source);
  }
}

export function useCommandDiscovery(): void {
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const versionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const discover = useCallback(async (agentId?: string) => {
    try {
      const response = await fetch("/api/deck/commands/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentId ? { agentId } : {}),
      });

      if (!response.ok) {
        console.warn(`[useCommandDiscovery] Discovery failed: HTTP ${response.status}`);
        return;
      }

      if (!mountedRef.current) {
        return;
      }

      const data = (await response.json()) as DeckCommandsDiscoverResult;

      if (!mountedRef.current) {
        return;
      }

      if (data.version === versionRef.current) {
        return;
      }

      versionRef.current = data.version;
      unregisterDiscoveredCommands();

      for (const cmd of data.commands) {
        const source = cmd.source;
        const category =
          cmd.category ??
          (source === "skill" ? "skills" : source === "plugin" ? "plugins" : "more");
        const registered: RegisteredCommand = {
          name: cmd.name,
          source,
          execMode: "remote",
          description: cmd.description,
          args: cmd.args,
          argOptions: cmd.argChoices,
          category,
          priority: SOURCE_PRIORITY[source],
          skillName: cmd.skillName,
          pluginId: cmd.pluginId,
        };
        commandRegistry.register(registered);
      }
    } catch (error) {
      console.warn("[useCommandDiscovery] Failed to discover commands:", error);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    versionRef.current = null;
    void discover(activeAgentId ?? undefined);

    const es = new EventSource("/api/stream");
    const onChanged = () => {
      void discover(activeAgentId ?? undefined);
    };

    es.addEventListener("commands.changed", onChanged);
    es.addEventListener("error", () => {
      console.warn("[useCommandDiscovery] SSE connection error - command updates may be delayed");
    });

    return () => {
      mountedRef.current = false;
      es.removeEventListener("commands.changed", onChanged);
      es.close();
      unregisterDiscoveredCommands();
    };
  }, [activeAgentId, discover]);
}
