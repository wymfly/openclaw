import { useEffect } from "react";
import {
  useCommandDiscoveryProjectionInvalidation,
  useCommandDiscoveryQuery,
} from "@/data/modules/commands";
import { commandRegistry } from "@/lib/command-registry";
import { SOURCE_PRIORITY, type RegisteredCommand } from "@/lib/command-types";
import { useChatStore } from "@/stores/chat";

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
  const discoveryQuery = useCommandDiscoveryQuery(activeAgentId);

  useCommandDiscoveryProjectionInvalidation(activeAgentId);

  useEffect(() => {
    const data = discoveryQuery.data as CommandDiscoveryResult | undefined;
    if (!data) {
      return undefined;
    }

    unregisterDiscoveredCommands();
    for (const command of data.commands ?? []) {
      const registered = toRegisteredCommand(command);
      if (registered) {
        commandRegistry.register(registered);
      }
    }

    return () => {
      unregisterDiscoveredCommands();
    };
  }, [discoveryQuery.data]);

  useEffect(() => {
    if (discoveryQuery.isError) {
      console.warn("[useCommandDiscovery] Failed to discover commands:", discoveryQuery.error);
    }
  }, [discoveryQuery.error, discoveryQuery.isError]);
}
