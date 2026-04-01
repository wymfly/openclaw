import { createHash } from "node:crypto";
import { resolveDefaultAgentId } from "../../../agents/agent-scope.js";
import { getChatCommands } from "../../../auto-reply/commands-registry.data.js";
import { listSkillCommandsForAgents } from "../../../auto-reply/skill-commands.js";
import { loadConfig } from "../../../config/config.js";
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
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";

interface DiscoverableCommand {
  name: string;
  source: "builtin" | "skill" | "plugin";
  description: string;
  args?: string;
  argChoices?: string[];
  category?: string;
  skillName?: string;
  pluginId?: string;
}

export const deckCommandsHandlers: GatewayRequestHandlers = {
  "deck.commands.discover": async ({ params, respond }) => {
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
      const agentId = (params as { agentId?: string }).agentId ?? resolveDefaultAgentId(cfg);
      const commands: DiscoverableCommand[] = [];

      // 1. Built-in commands (text-scope only)
      const builtins = getChatCommands();
      for (const cmd of builtins) {
        if (cmd.scope === "native") continue;
        const textAlias = cmd.textAliases?.[0];
        const name = textAlias ? textAlias.replace(/^\//, "") : cmd.key;

        const argChoices: string[] = [];
        if (cmd.args) {
          for (const arg of cmd.args) {
            if (Array.isArray(arg.choices)) {
              for (const c of arg.choices) {
                argChoices.push(typeof c === "string" ? c : c.value);
              }
            }
          }
        }

        commands.push({
          name,
          source: "builtin",
          description: cmd.description,
          args: cmd.acceptsArgs
            ? cmd.args?.map((a) => `<${a.name}>`).join(" ") || "<args>"
            : undefined,
          argChoices: argChoices.length > 0 ? argChoices : undefined,
          category: "more",
        });
      }

      // 2. Skill commands — scoped to specific agent
      const skillCmds = listSkillCommandsForAgents({
        cfg,
        agentIds: [agentId],
      });
      for (const sc of skillCmds) {
        commands.push({
          name: sc.name,
          source: "skill",
          description: sc.description,
          category: "skills",
          skillName: sc.skillName,
        });
      }

      // 3. Plugin commands (placeholder — future extension point)

      // Version hash includes all discoverable fields for full change detection
      const hashInput = commands
        .map(
          (c) =>
            `${c.source}:${c.name}:${c.description}:${c.args ?? ""}:${c.category ?? ""}:${(c.argChoices ?? []).join(";")}`,
        )
        .sort()
        .join(",");
      const version = createHash("md5").update(hashInput).digest("hex").slice(0, 12);

      respond(true, { commands, version });
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to discover commands: ${err instanceof Error ? err.message : String(err)}`,
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
  },
};
