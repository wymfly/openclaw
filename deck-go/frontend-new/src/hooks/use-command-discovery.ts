import { useCallback, useEffect, useRef } from "react";
import { commandRegistry } from "@/lib/command-registry";
import { SOURCE_PRIORITY, type RegisteredCommand } from "@/lib/command-types";
import { deckFetch } from "@/lib/deck-client";
import { useChatStore } from "@/stores/chat";
import { useLiveProjectionSubscription } from "./useLiveProjectionSubscription";

type DiscoveredSource = Extract<RegisteredCommand["source"], "builtin" | "skill" | "plugin">;

type DiscoveredCommand = {
  name?: unknown;
  source?: unknown;
  description?: unknown;
  aliases?: unknown;
  args?: unknown;
  argChoices?: unknown;
  category?: unknown;
  skillName?: unknown;
  pluginId?: unknown;
};

type CommandDiscoveryResult = {
  commands?: DiscoveredCommand[];
  version?: string;
};

const DISCOVERED_SOURCES: DiscoveredSource[] = ["builtin", "skill", "plugin"];

function isDiscoveredSource(source: unknown): source is DiscoveredSource {
  return source === "builtin" || source === "skill" || source === "plugin";
}

function unregisterDiscoveredCommands(): void {
  for (const source of DISCOVERED_SOURCES) {
    commandRegistry.unregisterBySource(source);
  }
}

function toRegisteredCommand(command: DiscoveredCommand): RegisteredCommand | null {
  if (typeof command.name !== "string" || !command.name.trim()) {
    return null;
  }
  if (!isDiscoveredSource(command.source)) {
    return null;
  }

  const source = command.source;
  const category =
    typeof command.category === "string" && command.category.trim()
      ? command.category
      : source === "skill"
        ? "skills"
        : source === "plugin"
          ? "plugins"
          : "more";
  const argChoices = Array.isArray(command.argChoices)
    ? command.argChoices.filter((choice): choice is string => typeof choice === "string")
    : undefined;
  const aliases = Array.isArray(command.aliases)
    ? command.aliases
        .filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0)
        .map((alias) => alias.trim().replace(/^\//u, ""))
        .filter((alias) => alias.length > 0)
    : undefined;

  return {
    name: command.name.trim(),
    aliases,
    source,
    execMode: "remote",
    description: typeof command.description === "string" ? command.description : command.name,
    args: typeof command.args === "string" ? command.args : undefined,
    argOptions: argChoices,
    category,
    priority: SOURCE_PRIORITY[source],
    skillName: typeof command.skillName === "string" ? command.skillName : undefined,
    pluginId: typeof command.pluginId === "string" ? command.pluginId : undefined,
  };
}

export function useCommandDiscovery(): void {
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const versionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const discover = useCallback(async (agentId?: string) => {
    try {
      const response = await deckFetch("/api/deck/commands/discover", {
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

      const data = (await response.json()) as CommandDiscoveryResult;
      if (!mountedRef.current || data.version === versionRef.current) {
        return;
      }

      versionRef.current = data.version ?? null;
      unregisterDiscoveredCommands();
      for (const command of data.commands ?? []) {
        const registered = toRegisteredCommand(command);
        if (registered) {
          commandRegistry.register(registered);
        }
      }
    } catch (error) {
      console.warn("[useCommandDiscovery] Failed to discover commands:", error);
    }
  }, []);

  const handleStreamEvent = useCallback(
    (event: { event?: string }) => {
      if (event.event === "commands.changed") {
        void discover(activeAgentId ?? undefined);
      }
    },
    [activeAgentId, discover],
  );

  useLiveProjectionSubscription({
    projectionId: "command-discovery",
    onEvent: handleStreamEvent,
    onProjectionGap: () => discover(activeAgentId ?? undefined),
  });

  useEffect(() => {
    mountedRef.current = true;
    versionRef.current = null;
    void discover(activeAgentId ?? undefined);

    return () => {
      mountedRef.current = false;
      unregisterDiscoveredCommands();
    };
  }, [activeAgentId, discover]);
}
