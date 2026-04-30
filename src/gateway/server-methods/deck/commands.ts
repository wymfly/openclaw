import { createHash } from "node:crypto";
import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckCommandsDiscoverParams,
} from "../../protocol/index.js";
import {
  DeckCommandsDiscoverParamsSchema,
  DeckCommandsDiscoverResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService } from "../../services/config.service.js";
import { skillsService, type ChatCommandDefinition } from "../../services/skills.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";

const { resolveDefaultAgentId } = agentsService;
const { loadConfig } = configService;
const { getChatCommands, listSkillCommandsForAgents } = skillsService;

type DiscoverableCommand = {
  name: string;
  source: "builtin" | "skill" | "plugin";
  description: string;
  args?: string;
  argChoices?: string[];
  category?: string;
  skillName?: string;
  pluginId?: string;
};

function normalizeCommandName(command: ChatCommandDefinition): string {
  const textAlias = command.textAliases[0];
  if (!textAlias) {
    return command.key;
  }
  return textAlias.replace(/^\//, "");
}

function formatBuiltinArgs(command: ChatCommandDefinition): string | undefined {
  if (!command.acceptsArgs) {
    return undefined;
  }
  if (!command.args?.length) {
    return "<args>";
  }
  return command.args
    .map((arg) => (arg.captureRemaining ? `<${arg.name}...>` : `<${arg.name}>`))
    .join(" ");
}

function resolveBuiltinArgChoices(command: ChatCommandDefinition): string[] | undefined {
  if (!command.args?.length) {
    return undefined;
  }
  const choices: string[] = [];
  for (const arg of command.args) {
    if (!Array.isArray(arg.choices)) {
      continue;
    }
    for (const choice of arg.choices) {
      const value = typeof choice === "string" ? choice : choice.value;
      if (!value) {
        continue;
      }
      choices.push(value);
    }
  }
  if (!choices.length) {
    return undefined;
  }
  return Array.from(new Set(choices));
}

function buildDiscoverVersion(commands: DiscoverableCommand[]): string {
  const hashInput = commands
    .map(
      (command) =>
        `${command.source}:${command.name}:${command.description}:${command.args ?? ""}:${command.category ?? ""}:${(command.argChoices ?? []).join(";")}`,
    )
    .toSorted()
    .join(",");
  return createHash("md5").update(hashInput).digest("hex").slice(0, 12);
}

export const deckCommandsHandlers: GatewayRequestHandlers = {
  "deck.commands.discover": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckCommandsDiscoverParams,
        "deck.commands.discover",
        respond,
      )
    ) {
      return;
    }

    try {
      const cfg = loadConfig();
      const requestedAgentId =
        typeof params.agentId === "string" && params.agentId.trim() ? params.agentId : undefined;
      const agentId = requestedAgentId ?? resolveDefaultAgentId(cfg);
      const commands: DiscoverableCommand[] = [];

      // 1) Built-in chat commands (text + both; skip native-only)
      for (const command of getChatCommands()) {
        if (command.scope === "native") {
          continue;
        }
        commands.push({
          name: normalizeCommandName(command),
          source: "builtin",
          description: command.description,
          args: formatBuiltinArgs(command),
          argChoices: resolveBuiltinArgChoices(command),
          category: "more",
        });
      }

      // 2) Skill commands for the selected agent
      for (const command of listSkillCommandsForAgents({ cfg, agentIds: [agentId] })) {
        commands.push({
          name: command.name,
          source: "skill",
          description: command.description,
          category: "skills",
          skillName: command.skillName,
        });
      }

      // 3) Plugin commands reserved for future extension

      commands.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name));
      const version = buildDiscoverVersion(commands);

      respond(true, { commands, version });
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to discover commands: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  },
};

export const deckCommandsMethodDefs: Record<string, MethodMetadata> = {
  "deck.commands.discover": {
    params: DeckCommandsDiscoverParamsSchema,
    result: DeckCommandsDiscoverResultSchema,
    scope: "operator.read",
    forkClass: "C1",
    bffEligible: false,
  },
};
