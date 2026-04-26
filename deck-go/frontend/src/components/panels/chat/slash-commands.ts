export type SlashCommandCategory = "session" | "model" | "tools" | "agents";

export interface SlashCommandDef {
  name: string;
  descriptionKey: string;
  args?: string;
  icon: string;
  category: SlashCommandCategory;
  argOptions?: string[];
}

export const LOCAL_COMMAND_DEFS: SlashCommandDef[] = [
  { name: "new", descriptionKey: "cmd_new", icon: "plus", category: "session" },
  { name: "reset", descriptionKey: "cmd_reset", icon: "refresh-cw", category: "session" },
  { name: "compact", descriptionKey: "cmd_compact", icon: "minimize-2", category: "session" },
  { name: "stop", descriptionKey: "cmd_stop", icon: "square", category: "session" },
  { name: "clear", descriptionKey: "cmd_clear", icon: "trash-2", category: "session" },
  { name: "export", descriptionKey: "cmd_export", icon: "download", category: "session" },
  { name: "model", descriptionKey: "cmd_model", args: "<name>", icon: "cpu", category: "model" },
  {
    name: "think",
    descriptionKey: "cmd_think",
    args: "<off|low|medium|high>",
    icon: "brain",
    category: "model",
    argOptions: ["off", "low", "medium", "high"],
  },
  {
    name: "fast",
    descriptionKey: "cmd_fast",
    args: "<status|on|off>",
    icon: "zap",
    category: "model",
    argOptions: ["status", "on", "off"],
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
    name: "reasoning",
    descriptionKey: "cmd_reasoning",
    args: "<off|on|stream>",
    icon: "lightbulb",
    category: "model",
    argOptions: ["off", "on", "stream"],
  },
  {
    name: "sendpolicy",
    descriptionKey: "cmd_sendpolicy",
    args: "<allow|deny>",
    icon: "shield",
    category: "session",
    argOptions: ["allow", "deny"],
  },
  { name: "help", descriptionKey: "cmd_help", icon: "book-open", category: "tools" },
  { name: "usage", descriptionKey: "cmd_usage", icon: "bar-chart-2", category: "tools" },
  { name: "agents", descriptionKey: "cmd_agents", icon: "monitor", category: "agents" },
];

export const CATEGORY_LABEL_KEYS: Record<string, string> = {
  session: "cmdCatSession",
  model: "cmdCatModel",
  tools: "cmdCatTools",
  agents: "cmdCatAgents",
  skills: "cmdCatSkills",
  plugins: "cmdCatPlugins",
  more: "cmdCatMore",
};

export function parseSlashCommand(text: string): { name: string; args: string } | null {
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
  return { name: name.toLowerCase(), args: remainder.trim() };
}
