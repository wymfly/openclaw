import type { SlashCommandResult } from "@/components/panels/chat/slash-command-executor";

export type CommandSource = "local" | "builtin" | "skill" | "plugin";

export type CommandExecMode = "local" | "remote";

/** Priority values — lower number = higher priority. Matches official: plugin > local > builtin > skill. */
export const SOURCE_PRIORITY: Record<CommandSource, number> = {
  plugin: 0,
  local: 10,
  builtin: 20,
  skill: 30,
};

export interface CommandVisibilityContext {
  isStreaming: boolean;
  hasMessages: boolean;
  sessionStatus: string;
}

export interface RegisteredCommand {
  name: string;
  source: CommandSource;
  execMode: CommandExecMode;
  /** i18n key under "chat" namespace (local commands). */
  descriptionKey?: string;
  /** Raw description text (remote commands from discover). */
  description?: string;
  args?: string;
  argOptions?: string[];
  icon?: string;
  category: string;
  priority: number;
  /** Local-only: handler function. */
  execute?: (sessionKey: string, args: string) => Promise<SlashCommandResult>;
  /** Visibility predicate — controls palette visibility, not execution. */
  visibleIf?: (ctx: CommandVisibilityContext) => boolean;
  /** Skill-specific: original skill name. */
  skillName?: string;
  /** Plugin-specific: plugin id. */
  pluginId?: string;
}
