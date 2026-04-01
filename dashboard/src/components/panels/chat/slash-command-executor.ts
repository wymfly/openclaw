/**
 * Client-side execution engine for slash commands.
 * Calls dashboard API routes and returns formatted results.
 * Mirrors official ui/src/ui/chat/slash-command-executor.ts patterns.
 */
import { formatTokenCount } from "@/lib/format-utils";
import { SLASH_COMMANDS } from "./slash-commands";

export type SlashCommandAction = "new-session" | "reset" | "stop" | "clear" | "export" | "refresh";

export interface SlashCommandResult {
  /** Text content to display as system message (empty string = no display). */
  content: string;
  /** Side-effect action the caller should perform after displaying the result. */
  action?: SlashCommandAction;
  /** Toast notification message (shown via addToast). */
  toastMessage?: string;
  /** Toast type. Defaults to "info" if toastMessage is set but toastType is not. */
  toastType?: "success" | "info" | "error";
  /** Optimistic config update to apply to SessionMeta immediately. */
  configUpdate?: Record<string, unknown>;
}

export async function executeSlashCommand(
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  switch (commandName) {
    case "help":
      return executeHelp();
    case "new":
      return { content: "", action: "new-session" };
    case "reset":
      return { content: "", action: "reset" };
    case "stop":
      return { content: "", action: "stop" };
    case "clear":
      return { content: "", action: "clear" };
    case "export":
      return { content: "", action: "export" };
    case "compact":
      return executeCompact(sessionKey);
    case "model":
      return executeModel(sessionKey, args);
    case "think":
      return executeThink(sessionKey, args);
    case "fast":
      return executeFast(sessionKey, args);
    case "verbose":
      return executeVerbose(sessionKey, args);
    case "usage":
      return executeUsage(sessionKey);
    case "agents":
      return executeAgents();
    case "kill":
      return executeKill(sessionKey, args);
    default:
      return { content: `Unknown command: /${commandName}` };
  }
}

// ── Helpers ──

function executeHelp(): SlashCommandResult {
  const lines = SLASH_COMMANDS.map((cmd) => `/${cmd.name}${cmd.args ? ` ${cmd.args}` : ""}`);
  return { content: lines.join("\n") };
}

async function executeCompact(sessionKey: string): Promise<SlashCommandResult> {
  try {
    const res = await fetch("/api/chat/compact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return {
        content: "",
        toastMessage: (d as { error?: string }).error ?? "Compaction failed",
        toastType: "error",
      };
    }
    return {
      content: "",
      action: "refresh",
      toastMessage: "Session compacted",
      toastType: "success",
    };
  } catch {
    return { content: "", toastMessage: "Compaction failed", toastType: "error" };
  }
}

async function executeModel(sessionKey: string, args: string): Promise<SlashCommandResult> {
  if (!args) {
    // Fetch current model + available models list (mirrors official executor)
    try {
      const [sessRes, modelsRes] = await Promise.all([
        fetch("/api/sessions"),
        fetch("/api/models"),
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
    `Model: ${args.trim()}`,
    "Failed to set model",
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
    `Thinking: ${level}`,
    "Failed to set thinking level",
  );
}

async function executeFast(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const mode = args.trim().toLowerCase();
  if (!mode || mode === "status") {
    try {
      const res = await fetch("/api/sessions");
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
    `Fast mode: ${mode}`,
    "Failed to set fast mode",
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
    `Verbose: ${level}`,
    "Failed to set verbose level",
  );
}

async function executeUsage(sessionKey: string): Promise<SlashCommandResult> {
  try {
    const res = await fetch("/api/sessions");
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

async function executeAgents(): Promise<SlashCommandResult> {
  try {
    const res = await fetch("/api/agents");
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

async function executeKill(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const target = args.trim();
  if (!target) {
    return { content: "Usage: /kill <id|all>" };
  }
  try {
    const res = await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey: target === "all" ? sessionKey : target }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return {
        content: "",
        toastMessage: (d as { error?: string }).error ?? "Failed to abort",
        toastType: "error",
      };
    }
    return { content: "", toastMessage: `Aborted: ${target}`, toastType: "success" };
  } catch {
    return { content: "", toastMessage: "Failed to abort", toastType: "error" };
  }
}

// ── Shared ──

async function patchSession(
  sessionKey: string,
  params: Record<string, unknown>,
  successMsg: string,
  errorMsg: string,
): Promise<SlashCommandResult> {
  try {
    const res = await fetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, ...params }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return {
        content: "",
        toastMessage: (d as { error?: string }).error ?? errorMsg,
        toastType: "error",
      };
    }
    return {
      content: "",
      action: "refresh",
      toastMessage: successMsg,
      toastType: "success",
      configUpdate: params,
    };
  } catch {
    return { content: "", toastMessage: errorMsg, toastType: "error" };
  }
}
