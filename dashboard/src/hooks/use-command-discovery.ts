"use client";

import { useEffect, useRef } from "react";
import { commandRegistry } from "@/lib/command-registry";
import { SOURCE_PRIORITY } from "@/lib/command-types";
import type { RegisteredCommand } from "@/lib/command-types";

/**
 * Discovers available commands from Gateway via deck.commands.discover RPC.
 * Listens for SSE `commands.changed` events to refresh.
 */
export function useCommandDiscovery() {
  const versionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function discover() {
      try {
        const res = await fetch("/api/deck/commands/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok || !mountedRef.current) return;
        const data = (await res.json()) as {
          commands?: Array<{
            name: string;
            source: "builtin" | "skill" | "plugin";
            description: string;
            args?: string;
            argChoices?: string[];
            category?: string;
            skillName?: string;
            pluginId?: string;
          }>;
          version?: string;
        };

        if (!mountedRef.current) return;

        const newVersion = data.version ?? "";
        if (newVersion === versionRef.current) return;
        versionRef.current = newVersion;

        // Clear previous remote commands
        commandRegistry.unregisterBySource("builtin");
        commandRegistry.unregisterBySource("skill");
        commandRegistry.unregisterBySource("plugin");

        // Register discovered commands
        for (const cmd of data.commands ?? []) {
          const source = cmd.source;
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
      } catch {
        // Silently fail — local commands remain available
      }
    }

    discover();

    // Listen for SSE commands.changed events to re-discover
    const es = new EventSource("/api/stream");
    es.addEventListener("commands.changed", () => {
      discover();
    });

    return () => {
      mountedRef.current = false;
      es.close();
      // Clean up remote commands
      commandRegistry.unregisterBySource("builtin");
      commandRegistry.unregisterBySource("skill");
      commandRegistry.unregisterBySource("plugin");
    };
  }, []);
}
