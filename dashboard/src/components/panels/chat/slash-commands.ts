/**
 * Slash command registry, parser, and filter — mirrors official ui/src/ui/chat/slash-commands.ts.
 *
 * 15 commands across 4 categories (session/model/tools/agents).
 * /steer and /skill deferred — require complex parameter parsing.
 */

export type SlashCommandCategory = "session" | "model" | "tools" | "agents";

export interface SlashCommandDef {
  name: string;
  /** i18n key under "chat" namespace, e.g. "cmd_new" */
  descriptionKey: string;
  args?: string;
  /** lucide icon name in kebab-case */
  icon: string;
  category: SlashCommandCategory;
  /** Fixed argument choices for inline hints. */
  argOptions?: string[];
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  // ── Session ──
  { name: "new", descriptionKey: "cmd_new", icon: "plus", category: "session" },
  { name: "reset", descriptionKey: "cmd_reset", icon: "refresh-cw", category: "session" },
  { name: "compact", descriptionKey: "cmd_compact", icon: "minimize-2", category: "session" },
  { name: "stop", descriptionKey: "cmd_stop", icon: "square", category: "session" },
  { name: "clear", descriptionKey: "cmd_clear", icon: "trash-2", category: "session" },
  // ── Model ──
  {
    name: "model",
    descriptionKey: "cmd_model",
    args: "<name>",
    icon: "cpu",
    category: "model",
  },
  {
    name: "think",
    descriptionKey: "cmd_think",
    args: "<level>",
    icon: "brain",
    category: "model",
    argOptions: ["off", "low", "medium", "high"],
  },
  {
    name: "verbose",
    descriptionKey: "cmd_verbose",
    args: "<on|off|full>",
    icon: "terminal",
    category: "model",
    argOptions: ["on", "off", "full"],
  },
  {
    name: "fast",
    descriptionKey: "cmd_fast",
    args: "<status|on|off>",
    icon: "zap",
    category: "model",
    argOptions: ["status", "on", "off"],
  },
  // ── Tools ──
  { name: "help", descriptionKey: "cmd_help", icon: "book-open", category: "tools" },
  { name: "export", descriptionKey: "cmd_export", icon: "download", category: "tools" },
  { name: "usage", descriptionKey: "cmd_usage", icon: "bar-chart-2", category: "tools" },
  // ── Agents ──
  { name: "agents", descriptionKey: "cmd_agents", icon: "monitor", category: "agents" },
  {
    name: "kill",
    descriptionKey: "cmd_kill",
    args: "<id|all>",
    icon: "x",
    category: "agents",
  },
];

const CATEGORY_ORDER: SlashCommandCategory[] = ["session", "model", "tools", "agents"];

/** i18n keys for category labels. */
export const CATEGORY_LABEL_KEYS: Record<SlashCommandCategory, string> = {
  session: "cmdCatSession",
  model: "cmdCatModel",
  tools: "cmdCatTools",
  agents: "cmdCatAgents",
};

/**
 * Return commands matching the given filter, sorted by category then relevance.
 * Matches against command name (prefix) and description key (contains).
 */
export function getSlashCommandCompletions(filter: string): SlashCommandDef[] {
  const lower = filter.toLowerCase();
  const commands = lower
    ? SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(lower))
    : SLASH_COMMANDS;

  return commands.toSorted((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    if (ai !== bi) {
      return ai - bi;
    }
    if (lower) {
      const aExact = a.name.startsWith(lower) ? 0 : 1;
      const bExact = b.name.startsWith(lower) ? 0 : 1;
      if (aExact !== bExact) {
        return aExact - bExact;
      }
    }
    return 0;
  });
}

export interface ParsedSlashCommand {
  command: SlashCommandDef;
  args: string;
}

/**
 * Parse user input as a slash command.
 * Returns null if it doesn't match any registered command.
 * Supports: `/command`, `/command args...`, `/command: args...`.
 */
export function parseSlashCommand(text: string): ParsedSlashCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const body = trimmed.slice(1);
  const firstSep = body.search(/[\s:]/u);
  const name = firstSep === -1 ? body : body.slice(0, firstSep);
  let remainder = firstSep === -1 ? "" : body.slice(firstSep).trimStart();
  if (remainder.startsWith(":")) {
    remainder = remainder.slice(1).trimStart();
  }

  if (!name) {
    return null;
  }
  const command = SLASH_COMMANDS.find((cmd) => cmd.name === name.toLowerCase());
  if (!command) {
    return null;
  }

  return { command, args: remainder.trim() };
}
