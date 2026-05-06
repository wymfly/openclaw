import { fetchAgentsList, fetchRuntimeConfiguredModels, fetchSessions } from "@/api";
import { commandRegistry } from "@/lib/command-registry";
import { formatTokenCount } from "@/lib/format-utils";
import { useChatStore } from "@/stores/chat";
import type { SessionMeta } from "@/stores/chat-types";
import type { ToastType } from "@/stores/notifications";
import {
  clearChatSession,
  compactChatSession,
  patchChatSession,
  resetChatSession,
  sendChatMessage,
} from "./chat-api";
import { exportSessionAsMarkdown } from "./export-session";
import { LOCAL_COMMAND_DEFS } from "./slash-commands";

export type SlashCommandAction = "new-session" | "reset" | "stop" | "clear" | "export" | "refresh";
type LocalCommandHandler = (sessionKey: string, args: string) => Promise<SlashCommandResult>;

export interface SlashCommandResult {
  content: string;
  action?: SlashCommandAction;
  toastKey?: string;
  toastValue?: string;
  toastType?: ToastType;
  configUpdate?: Partial<
    Pick<
      SessionMeta,
      | "model"
      | "thinkingLevel"
      | "fastMode"
      | "verboseLevel"
      | "reasoningLevel"
      | "responseUsage"
      | "sendPolicy"
    >
  >;
}

let initialized = false;
type ConfigPatch = NonNullable<SlashCommandResult["configUpdate"]>;
type UsageSession = SessionMeta & {
  inputTokens?: number;
  outputTokens?: number;
  tokensIn?: number;
  tokensOut?: number;
};
type ConfiguredModel = {
  id?: string;
  name?: string;
  model?: string;
  modelIdentifier?: string;
};

const LOCAL_COMMAND_HANDLERS: Record<string, LocalCommandHandler> = {
  agents: () => listAgents(),
  clear: (sessionKey) => clearLocalSession(sessionKey),
  compact: (sessionKey) => compactLocalSession(sessionKey),
  export: async (sessionKey) => exportLocalSession(sessionKey),
  fast: (sessionKey, args) => executeFastMode(sessionKey, args),
  help: async () => executeHelp(),
  model: (sessionKey, args) => executeModel(sessionKey, args),
  new: async () => ({ content: "", action: "new-session" }),
  reasoning: (sessionKey, args) => executeReasoning(sessionKey, args),
  reset: (sessionKey) => resetLocalSession(sessionKey),
  sendpolicy: (sessionKey, args) => executeSendPolicy(sessionKey, args),
  stop: async () => ({ content: "", action: "stop" }),
  think: (sessionKey, args) => executeThink(sessionKey, args),
  usage: (sessionKey, args) => executeUsage(sessionKey, args),
  verbose: (sessionKey, args) => executeVerbose(sessionKey, args),
};

export function initializeLocalCommands(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  commandRegistry.registerLocalCommands(LOCAL_COMMAND_DEFS);

  for (const [name, handler] of Object.entries(LOCAL_COMMAND_HANDLERS)) {
    const command = getRegisteredLocalCommand(name);
    if (command) {
      command.execute = handler;
    }
  }

  const stopCommand = getRegisteredLocalCommand("stop");
  if (stopCommand) {
    stopCommand.visibleIf = (context) => context.isStreaming;
  }
  const compactCommand = getRegisteredLocalCommand("compact");
  if (compactCommand) {
    compactCommand.visibleIf = (context) => context.hasMessages;
  }
}

export async function executeSlashCommand(
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  initializeLocalCommands();
  const normalizedName = commandName.trim().toLowerCase();
  const command = commandRegistry.get(normalizedName);
  if (!command) {
    return {
      content: "",
      toastKey: "toastUnknownCommand",
      toastValue: normalizedName,
      toastType: "error",
    };
  }
  if (command.execMode === "remote") {
    return executeRemoteCommand(sessionKey, normalizedName, args);
  }
  if (command.execute) {
    return command.execute(sessionKey, args);
  }
  return {
    content: "",
    toastKey: "toastUnknownCommand",
    toastValue: normalizedName,
    toastType: "error",
  };
}

function getRegisteredLocalCommand(name: string) {
  const active = commandRegistry.get(name);
  if (active?.source === "local") {
    return active;
  }
  return commandRegistry.get(`local:${name}`);
}

function executeHelp(): SlashCommandResult {
  return {
    content: LOCAL_COMMAND_DEFS.map(
      (command) => `/${command.name}${command.args ? ` ${command.args}` : ""}`,
    ).join("\n"),
  };
}

async function executeRemoteCommand(
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  try {
    const message = args ? `/${commandName} ${args}` : `/${commandName}`;
    await sendChatMessage({ sessionKey, message });
    return {
      content: "",
      toastKey: "toastCommandSent",
      toastValue: commandName,
      toastType: "success",
    };
  } catch {
    return { content: "", toastKey: "toastCommandSentFailed", toastType: "error" };
  }
}

async function findSession(sessionKey: string): Promise<UsageSession | undefined> {
  const data = await fetchSessions();
  return (data.sessions ?? []).find((session) => session.key === sessionKey) as
    | UsageSession
    | undefined;
}

async function getCurrentModel(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    const [session, configuredModels] = await Promise.all([
      findSession(sessionKey),
      fetchConfiguredModelIds(),
    ]);
    if (!session) {
      return { content: "No active session." };
    }
    const lines = [`Current model: ${session.model ?? "default"}`];
    if (configuredModels.length > 0) {
      const shown = configuredModels.slice(0, 10).join(", ");
      const extra = configuredModels.length > 10 ? ` +${configuredModels.length - 10} more` : "";
      lines.push(`Available: ${shown}${extra}`);
    }
    return { content: lines.join("\n") };
  } catch {
    return { content: "Failed to get model info" };
  }
}

async function fetchConfiguredModelIds(): Promise<string[]> {
  const data = await fetchRuntimeConfiguredModels();
  const models = data.payload?.models ?? data.payload?.items ?? [];
  const ids = models
    .map((model: ConfiguredModel) => model.id ?? model.model ?? model.modelIdentifier ?? model.name)
    .filter((model): model is string => typeof model === "string" && model.trim().length > 0);
  return [...new Set(ids)];
}

async function getFastModeStatus(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    const session = await findSession(sessionKey);
    if (!session) {
      return { content: "No active session." };
    }
    return { content: `Fast mode: ${session.fastMode ? "on" : "off"}` };
  } catch {
    return { content: "Failed to get fast mode status" };
  }
}

async function executeModel(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const model = args.trim();
  if (!model) {
    return getCurrentModel(sessionKey);
  }
  return patchSessionConfig(sessionKey, { model }, "toastModel", model, "toastModelFailed");
}

async function executeThink(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const level = args.trim().toLowerCase();
  if (!level) {
    return { content: "Usage: /think <off|low|medium|high>" };
  }
  if (!["off", "low", "medium", "high"].includes(level)) {
    return { content: `Invalid thinking level "${args.trim()}". Valid: off, low, medium, high` };
  }
  return patchSessionConfig(
    sessionKey,
    { thinkingLevel: level },
    "toastThink",
    level,
    "toastThinkFailed",
  );
}

async function executeFastMode(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const mode = args.trim().toLowerCase();
  if (!mode || mode === "status") {
    return getFastModeStatus(sessionKey);
  }
  if (mode !== "on" && mode !== "off") {
    return { content: `Invalid fast mode "${args.trim()}". Valid: status, on, off` };
  }
  return patchSessionConfig(
    sessionKey,
    { fastMode: mode === "on" },
    "toastFast",
    mode,
    "toastFastFailed",
  );
}

async function executeVerbose(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const level = args.trim().toLowerCase();
  if (!level) {
    return { content: "Usage: /verbose <on|off|full>" };
  }
  if (!["on", "off", "full"].includes(level)) {
    return { content: `Invalid verbose level "${args.trim()}". Valid: on, off, full` };
  }
  return patchSessionConfig(
    sessionKey,
    { verboseLevel: level },
    "toastVerbose",
    level,
    "toastVerboseFailed",
  );
}

async function executeReasoning(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const level = args.trim().toLowerCase();
  if (!level) {
    return { content: "Usage: /reasoning <off|on|stream>" };
  }
  if (!["off", "on", "stream"].includes(level)) {
    return { content: `Invalid reasoning level "${args.trim()}". Valid: off, on, stream` };
  }
  return patchSessionConfig(
    sessionKey,
    { reasoningLevel: level as "off" | "on" | "stream" },
    "toastReasoning",
    level,
    "toastReasoningFailed",
  );
}

async function executeSendPolicy(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const policy = args.trim().toLowerCase();
  if (!policy) {
    return { content: "Usage: /sendpolicy <allow|deny>" };
  }
  if (policy !== "allow" && policy !== "deny") {
    return { content: `Invalid send policy "${args.trim()}". Valid: allow, deny` };
  }
  return patchSessionConfig(
    sessionKey,
    { sendPolicy: policy },
    "toastSendPolicy",
    policy,
    "toastSendPolicyFailed",
  );
}

async function getSessionUsage(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    const session = await findSession(sessionKey);
    if (!session) {
      return { content: "No active session." };
    }
    const input = session.inputTokens ?? session.tokensIn ?? 0;
    const output = session.outputTokens ?? session.tokensOut ?? 0;
    const total = session.totalTokens ?? input + output;
    const lines = [
      `Input: ${formatTokenCount(input)} tokens`,
      `Output: ${formatTokenCount(output)} tokens`,
      `Total: ${formatTokenCount(total)} tokens`,
    ];
    if (session.model) {
      lines.push(`Model: ${session.model}`);
    }
    if (typeof session.estimatedCostUsd === "number") {
      lines.push(`Cost: $${session.estimatedCostUsd.toFixed(4)}`);
    }
    return { content: lines.join("\n") };
  } catch {
    return { content: "Failed to get usage" };
  }
}

async function executeUsage(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const mode = args.trim().toLowerCase();
  if (!mode || mode === "status") {
    return getSessionUsage(sessionKey);
  }
  if (!["off", "tokens", "full"].includes(mode)) {
    return { content: `Invalid usage display "${args.trim()}". Valid: status, off, tokens, full` };
  }
  return patchSessionConfig(
    sessionKey,
    { responseUsage: mode as "off" | "tokens" | "full" },
    "toastUsage",
    mode,
    "toastUsageFailed",
  );
}

async function listAgents(): Promise<SlashCommandResult> {
  try {
    const data = await fetchAgentsList();
    const agents = data.agents ?? [];
    if (agents.length === 0) {
      return { content: "No agents configured." };
    }
    return {
      content: agents
        .map((agent) => {
          const label = agent.name ?? agent.id;
          return `${label}${agent.id === data.defaultId ? " (default)" : ""}`;
        })
        .join("\n"),
    };
  } catch {
    return { content: "Failed to list agents" };
  }
}

async function patchSessionConfig(
  sessionKey: string,
  patch: ConfigPatch,
  toastKey: string,
  toastValue: string,
  failureToastKey: string,
): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    await patchChatSession({ sessionKey, ...patch });
    return {
      content: "",
      toastKey,
      toastValue,
      toastType: "success",
      configUpdate: patch,
    };
  } catch {
    return { content: "", toastKey: failureToastKey, toastType: "error" };
  }
}

async function exportLocalSession(sessionKey: string): Promise<SlashCommandResult> {
  const exported = exportSessionAsMarkdown(sessionKey);
  return {
    content: "",
    action: exported ? "export" : undefined,
    toastKey: exported ? "toastExported" : "toastExportFailed",
    toastType: exported ? "success" : "error",
  };
}

async function resetLocalSession(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    const result = await resetChatSession(sessionKey);
    if (result.ok === false) {
      return { content: "", toastKey: "toastResetFailed", toastType: "error" };
    }
    return {
      content: "",
      action: "reset",
      toastKey: "toastReset",
      toastType: "success",
    };
  } catch {
    return { content: "", toastKey: "toastResetFailed", toastType: "error" };
  }
}

async function clearLocalSession(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    const result = await clearChatSession(sessionKey);
    if (result.ok === false) {
      return { content: "", toastKey: "toastClearFailed", toastType: "error" };
    }
    return {
      content: "",
      action: "clear",
      toastKey: "toastCleared",
      toastType: "info",
    };
  } catch {
    return { content: "", toastKey: "toastClearFailed", toastType: "error" };
  }
}

async function compactLocalSession(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  const startedAt = Date.now();
  useChatStore.getState().setCommandState(sessionKey, "compact", {
    command: "compact",
    status: "running",
    startedAt,
    summary: "Compaction is running",
  });
  try {
    await compactChatSession(sessionKey);
    await reconcileSessionMeta(sessionKey);
    useChatStore.getState().setCommandState(sessionKey, "compact", {
      command: "compact",
      status: "completed",
      startedAt,
      completedAt: Date.now(),
      summary: "Compaction completed",
    });
    return {
      content: "",
      action: "refresh",
      toastKey: "toastCompacted",
      toastType: "success",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    useChatStore.getState().setCommandState(sessionKey, "compact", {
      command: "compact",
      status: "failed",
      startedAt,
      completedAt: Date.now(),
      summary: "Compaction failed",
      error: reason,
    });
    return { content: "", toastKey: "toastCompactFailed", toastType: "error" };
  }
}

async function reconcileSessionMeta(sessionKey: string): Promise<void> {
  try {
    const data = await fetchSessions();
    const session = (data.sessions ?? []).find(
      (item: { key?: unknown; sessionKey?: unknown }) =>
        item.key === sessionKey || item.sessionKey === sessionKey,
    ) as (Partial<SessionMeta> & { key?: string; sessionKey?: string }) | undefined;
    if (!session) {
      return;
    }
    useChatStore.setState((state) => {
      let found = false;
      const metas = state.sessionMetas.map((meta) => {
        if (meta.key !== sessionKey) {
          return meta;
        }
        found = true;
        return {
          ...meta,
          ...session,
          key: sessionKey,
          updatedAt:
            typeof session.updatedAt === "number"
              ? session.updatedAt
              : (meta.updatedAt ?? Date.now()),
        };
      });
      if (!found) {
        metas.unshift({
          agentId: session.agentId ?? state.activeAgentId ?? "main",
          updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : Date.now(),
          ...session,
          key: sessionKey,
        } as SessionMeta);
      }
      return { sessionMetas: metas, sessionMeta: metas };
    });
  } catch {
    // SSE/history refresh can still reconcile later; command state remains completed.
  }
}
