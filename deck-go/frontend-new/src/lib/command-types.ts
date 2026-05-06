export type CommandSource = "local" | "builtin" | "skill" | "plugin";

export type CommandExecMode = "local" | "remote";

/** Lower value = higher priority. Matches official CLI priority order. */
export const SOURCE_PRIORITY: Record<CommandSource, number> = {
  plugin: 0,
  local: 10,
  builtin: 20,
  skill: 30,
};

export interface CommandVisibilityContext {
  isStreaming: boolean;
  hasMessages: boolean;
}

export interface RegisteredCommand {
  name: string;
  aliases?: string[];
  source: CommandSource;
  execMode: CommandExecMode;
  description: string;
  args?: string;
  argOptions?: string[];
  category: string;
  priority: number;

  icon?: string;
  descriptionKey?: string;

  skillName?: string;
  pluginId?: string;

  execute?: (
    sessionKey: string,
    args: string,
  ) => Promise<import("@/components/panels/chat/slash-command-executor").SlashCommandResult>;
  visibleIf?: (ctx: CommandVisibilityContext) => boolean;
}
