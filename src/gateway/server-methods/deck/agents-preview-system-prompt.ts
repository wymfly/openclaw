import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsSystemPromptPreviewParams,
} from "../../protocol/index.js";
import {
  DeckAgentsSystemPromptPreviewParamsSchema,
  DeckAgentsSystemPromptPreviewResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { resolveDeckAgentReadConfig } from "./agent-read-config.js";

const {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
  loadWorkspaceBootstrapFiles,
  resolveAgentWorkspaceDir,
} = agentsService;
const { loadConfig, readConfigFileSnapshotForWrite, resolveConfigSnapshotHash } = configService;

const WELL_KNOWN_FILES = [
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_USER_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
] as const;

export const deckAgentsSystemPromptPreviewHandlers: GatewayRequestHandlers = {
  "deck.agents.systemPrompt.preview": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsSystemPromptPreviewParams,
        "deck.agents.systemPrompt.preview",
        respond,
      )
    ) {
      return;
    }
    const { agentId } = params as {
      agentId: string;
      context?: { channel?: string; chatType?: string };
    };

    const cfg = loadConfig();
    const agentConfig = resolveDeckAgentReadConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const bootstrapFiles = await loadWorkspaceBootstrapFiles(workspaceDir);

    const fileStats = WELL_KNOWN_FILES.map((name) => {
      const found = bootstrapFiles.find((file) => file.name === name);
      if (!found || found.missing) {
        return { name, exists: false, charCount: 0 };
      }
      return { name, exists: true, charCount: found.content?.length ?? 0 };
    });

    const bootstrapChars = fileStats.reduce((sum, file) => sum + file.charCount, 0);
    const identityFile = fileStats.find((file) => file.name === DEFAULT_IDENTITY_FILENAME);
    const identityChars = identityFile?.charCount ?? 0;

    const extraInstructions =
      typeof agentConfig.systemPromptOverride === "string" ? agentConfig.systemPromptOverride : "";

    const layers = [
      {
        label: "Bootstrap Files",
        source: workspaceDir,
        charCount: bootstrapChars,
        fileCount: fileStats.filter((file) => file.exists).length,
      },
      {
        label: "Identity",
        source: DEFAULT_IDENTITY_FILENAME,
        charCount: identityChars,
        fileCount: identityChars > 0 ? 1 : 0,
      },
      {
        label: "Skills Prompt",
        source: "skills injection",
        charCount: 0,
        fileCount: 0,
      },
      {
        label: "Extra Instructions",
        source: "agents.systemPrompt",
        charCount: extraInstructions.length,
        fileCount: extraInstructions.length > 0 ? 1 : 0,
      },
    ];

    const totalChars = bootstrapChars + extraInstructions.length;

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      layers,
      bootstrapFiles: fileStats,
      totalChars,
      configHash,
    });
  },
};

export const deckAgentsSystemPromptPreviewMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.systemPrompt.preview": {
    params: DeckAgentsSystemPromptPreviewParamsSchema,
    result: DeckAgentsSystemPromptPreviewResultSchema,
    scope: "operator.read",
    forkClass: "C4",
    bffEligible: false,
  },
};
