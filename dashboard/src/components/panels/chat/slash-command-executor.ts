import { commandRegistry } from "@/lib/command-registry";
/**
 * Client-side execution engine for slash commands.
 * Calls dashboard API routes and returns formatted results.
 * Mirrors official ui/src/ui/chat/slash-command-executor.ts patterns.
 */
import { deckFetch } from "@/lib/deck-client";
import { formatTokenCount } from "@/lib/format-utils";
import type { SessionMeta } from "@/stores/chat-types";
import type { ToastType } from "@/stores/notifications";
import {
  clearChatSession,
  compactChatSession,
  patchChatSession,
  resetChatSession,
  sendChatMessage,
} from "./chat-api";
import { LOCAL_COMMAND_DEFS } from "./slash-commands";

export type SlashCommandAction = "new-session" | "reset" | "stop" | "clear" | "export" | "refresh";

export interface SlashCommandResult {
  /** Text content to display as system message (empty string = no display). */
  content: string;
  /** Side-effect action the caller should perform after displaying the result. */
  action?: SlashCommandAction;
  /** i18n key for toast notification (resolved by caller via t()). */
  toastKey?: string;
  /** Dynamic value for toast message interpolation. */
  toastValue?: string;
  /** Toast type. */
  toastType?: ToastType;
  /** Optimistic config update to apply to SessionMeta immediately. */
  configUpdate?: Partial<
    Pick<SessionMeta, "model" | "thinkingLevel" | "fastMode" | "verboseLevel">
  >;
}

let initialized = false;

type LocalCommandHandler = (sessionKey: string, args: string) => Promise<SlashCommandResult>;

export function initializeLocalCommands(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  commandRegistry.registerLocalCommands(LOCAL_COMMAND_DEFS);

  const handlers: Record<string, LocalCommandHandler> = {
    help: async () => executeHelp(),
    new: async () => ({ content: "", action: "new-session" }),
    reset: (sessionKey) => executeReset(sessionKey),
    stop: async () => ({ content: "", action: "stop" }),
    clear: (sessionKey) => executeClear(sessionKey),
    export: async () => ({ content: "", action: "export" }),
    compact: (sessionKey) => executeCompact(sessionKey),
    model: (sessionKey, args) => executeModel(sessionKey, args),
    think: (sessionKey, args) => executeThink(sessionKey, args),
    fast: (sessionKey, args) => executeFast(sessionKey, args),
    verbose: (sessionKey, args) => executeVerbose(sessionKey, args),
    usage: (sessionKey) => executeUsage(sessionKey),
    agents: () => executeAgents(),
  };

  for (const [name, handler] of Object.entries(handlers)) {
    const cmd = commandRegistry.get(name);
    if (!cmd) {
      continue;
    }
    cmd.execute = handler;
  }

  const stopCmd = commandRegistry.get("stop");
  if (stopCmd) {
    stopCmd.visibleIf = (ctx) => ctx.isStreaming;
  }
  const compactCmd = commandRegistry.get("compact");
  if (compactCmd) {
    compactCmd.visibleIf = (ctx) => ctx.hasMessages;
  }
}

export async function executeSlashCommand(
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  initializeLocalCommands();

  const normalizedName = commandName.trim().toLowerCase();
  const cmd = commandRegistry.get(normalizedName);
  if (!cmd) {
    return {
      content: "",
      toastKey: "toastUnknownCommand",
      toastValue: normalizedName,
      toastType: "error",
    };
  }

  if (cmd.execMode === "local") {
    if (cmd.execute) {
      return cmd.execute(sessionKey, args);
    }
    return {
      content: "",
      toastKey: "toastUnknownCommand",
      toastValue: normalizedName,
      toastType: "error",
    };
  }

  if (cmd.execMode === "remote") {
    return executeRemoteCommand(sessionKey, normalizedName, args);
  }

  return {
    content: "",
    toastKey: "toastUnknownCommand",
    toastValue: normalizedName,
    toastType: "error",
  };
}

// ── Helpers ──

function executeHelp(): SlashCommandResult {
  const lines = LOCAL_COMMAND_DEFS.map((cmd) => `/${cmd.name}${cmd.args ? ` ${cmd.args}` : ""}`);
  return { content: lines.join("\n") };
}

async function executeRemoteCommand(
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  try {
    const message = args ? `/${commandName} ${args}` : `/${commandName}`;
    await sendChatMessage({ message, sessionKey });
    return {
      content: "",
      toastKey: "toastCommandSent",
      toastValue: commandName,
      toastType: "success",
    };
  } catch (error) {
    console.error("[executeRemoteCommand]", commandName, error);
    return { content: "", toastKey: "toastCommandSentFailed", toastType: "error" };
  }
}

async function executeCompact(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    await compactChatSession(sessionKey);
    return {
      content: "",
      action: "refresh",
      toastKey: "toastCompacted",
      toastType: "success",
    };
  } catch {
    return { content: "", toastKey: "toastCompactFailed", toastType: "error" };
  }
}

async function executeModel(sessionKey: string, args: string): Promise<SlashCommandResult> {
  if (!args) {
    // Fetch current model + available models list (mirrors official executor)
    try {
      const [sessRes, modelsRes] = await Promise.all([
        deckFetch("/api/sessions"),
        deckFetch("/api/models"),
      ]);
      if (!sessRes.ok || !modelsRes.ok) {
        return { content: "Failed to get model info" };
      }

      const sessData = (await sessRes.json()) as {
        sessions?: Array<{ key?: string; model?: string }>;
      };
      const modelsData = (await modelsRes.json()) as {
        models?: Array<{ id: string }>;
      };
      const sessions = sessData.sessions ?? [];
      const session = sessions.find((s) => s.key === sessionKey);
      const model = session?.model ?? "default";
      const available = (modelsData.models ?? []).map((m) => m.id);
      const lines = [`Current model: ${model}`];
      if (available.length > 0) {
        const shown = available.slice(0, 10).join(", ");
        const extra = available.length > 10 ? ` +${available.length - 10} more` : "";
        lines.push(`Available: ${shown}${extra}`);
      }
      return { content: lines.join("\n") };
    } catch {
      return { content: "Failed to get model info" };
    }
  }

  return patchSession(
    sessionKey,
    { model: args.trim() },
    "toastModel",
    args.trim(),
    "toastModelFailed",
  );
}

async function executeThink(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const level = args.trim().toLowerCase();
  if (!level) {
    return { content: "Usage: /think <off|low|medium|high>" };
  }
  if (!["off", "low", "medium", "high"].includes(level)) {
    return { content: `Invalid thinking level "${args.trim()}". Valid: off, low, medium, high` };
  }
  return patchSession(
    sessionKey,
    { thinkingLevel: level },
    "toastThink",
    level,
    "toastThinkFailed",
  );
}

async function executeFast(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const mode = args.trim().toLowerCase();
  if (!mode || mode === "status") {
    try {
      const res = await deckFetch("/api/sessions");
      if (!res.ok) {
        return { content: "Failed to get fast mode status" };
      }
      const data = (await res.json()) as {
        sessions?: Array<{ key?: string; fastMode?: boolean }>;
      };
      const session = (data.sessions ?? []).find((s) => s.key === sessionKey);
      const current = session?.fastMode ? "on" : "off";
      return { content: `Fast mode: ${current}` };
    } catch {
      return { content: "Failed to get fast mode status" };
    }
  }
  if (mode !== "on" && mode !== "off") {
    return { content: `Invalid fast mode "${args.trim()}". Valid: status, on, off` };
  }
  return patchSession(
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
  return patchSession(
    sessionKey,
    { verboseLevel: level },
    "toastVerbose",
    level,
    "toastVerboseFailed",
  );
}

async function executeUsage(sessionKey: string): Promise<SlashCommandResult> {
  try {
    const res = await deckFetch("/api/sessions");
    if (!res.ok) {
      return { content: "Failed to get usage" };
    }
    const data = (await res.json()) as {
      sessions?: Array<{
        key?: string;
        totalTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
        model?: string;
        estimatedCostUsd?: number;
      }>;
    };
    const sessions = data.sessions ?? [];
    const session = sessions.find((s) => s.key === sessionKey);
    if (!session) {
      return { content: "No active session." };
    }

    const input = session.inputTokens ?? 0;
    const output = session.outputTokens ?? 0;
    const total = session.totalTokens ?? input + output;
    const lines = [
      `Input: ${formatTokenCount(input)} tokens`,
      `Output: ${formatTokenCount(output)} tokens`,
      `Total: ${formatTokenCount(total)} tokens`,
    ];
    if (session.model) {
      lines.push(`Model: ${session.model}`);
    }
    if (session.estimatedCostUsd != null) {
      lines.push(`Cost: $${session.estimatedCostUsd.toFixed(4)}`);
    }
    return { content: lines.join("\n") };
  } catch {
    return { content: "Failed to get usage" };
  }
}

async function executeReset(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    await resetChatSession(sessionKey);
    return {
      content: "",
      action: "reset",
      toastKey: "toastReset",
      toastType: "success",
    };
  } catch {
    return {
      content: "",
      toastKey: "toastResetFailed",
      toastType: "error",
    };
  }
}

async function executeClear(sessionKey: string): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    await clearChatSession(sessionKey);
    return {
      content: "",
      action: "clear",
      toastKey: "toastCleared",
      toastType: "info",
    };
  } catch {
    return {
      content: "",
      toastKey: "toastClearFailed",
      toastType: "error",
    };
  }
}

async function executeAgents(): Promise<SlashCommandResult> {
  try {
    const res = await deckFetch("/api/agents");
    if (!res.ok) {
      return { content: "Failed to list agents" };
    }
    const data = (await res.json()) as {
      agents?: Array<{ id: string; name?: string; identity?: { name?: string } }>;
      defaultId?: string;
    };
    const agents = data.agents ?? [];
    if (agents.length === 0) {
      return { content: "No agents configured." };
    }
    const lines = agents.map((a) => {
      const isDefault = a.id === data.defaultId;
      const name = a.identity?.name ?? a.name ?? a.id;
      return `${name}${isDefault ? " (default)" : ""}`;
    });
    return { content: lines.join("\n") };
  } catch {
    return { content: "Failed to list agents" };
  }
}

// ── Shared ──

async function patchSession(
  sessionKey: string,
  params: Partial<Pick<SessionMeta, "model" | "thinkingLevel" | "fastMode" | "verboseLevel">>,
  successKey: string,
  successValue: string,
  errorKey: string,
): Promise<SlashCommandResult> {
  if (!sessionKey) {
    return { content: "No active session." };
  }
  try {
    await patchChatSession({ sessionKey, ...params });
    return {
      content: "",
      action: "refresh",
      toastKey: successKey,
      toastValue: successValue,
      toastType: "success",
      configUpdate: params,
    };
  } catch {
    return { content: "", toastKey: errorKey, toastType: "error" };
  }
}
