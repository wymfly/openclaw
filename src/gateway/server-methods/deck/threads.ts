import path from "node:path";
import { resolveStateDir } from "../../../config/paths.js";
import { loadJsonFile } from "../../../infra/json-file.js";
import { validateDeckThreadsListParams } from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";

/** Channels that have thread binding persistence support. */
const THREAD_BINDING_CHANNELS = new Set(["discord"]);

type PersistedThreadBinding = {
  accountId: string;
  channelId: string;
  threadId: string;
  targetKind: string;
  targetSessionKey: string;
  agentId: string;
  boundBy: string;
  boundAt: number;
  lastActivityAt: number;
  label?: string;
};

function resolveThreadBindingsPath(): string {
  return path.join(resolveStateDir(process.env), "discord", "thread-bindings.json");
}

function readThreadBindings(): PersistedThreadBinding[] {
  const raw = loadJsonFile(resolveThreadBindingsPath());
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const payload = raw as { version?: number; bindings?: Record<string, unknown> };
  if (payload.version !== 1 || !payload.bindings || typeof payload.bindings !== "object") {
    return [];
  }

  return Object.values(payload.bindings).filter(
    (b): b is PersistedThreadBinding => !!b && typeof b === "object" && "threadId" in b,
  );
}

export const deckThreadsHandlers: GatewayRequestHandlers = {
  "deck.threads.list": ({ params, respond }) => {
    if (!assertValidParams(params, validateDeckThreadsListParams, "deck.threads.list", respond)) {
      return;
    }
    const { channel, agentId, status } = params as {
      channel?: string;
      agentId?: string;
      status?: "active" | "all";
    };

    // Only Discord has thread binding support
    if (channel && !THREAD_BINDING_CHANNELS.has(channel)) {
      respond(true, { threads: [] });
      return;
    }

    let threads = readThreadBindings();

    if (agentId) {
      threads = threads.filter((t) => t.agentId === agentId);
    }

    // Currently all persisted bindings are considered "active"
    // (expired ones are swept and removed from file).
    // If status === "all", return everything; otherwise filter nothing extra.
    if (status && status !== "all" && status !== "active") {
      threads = [];
    }

    respond(true, {
      threads: threads.map((t) => ({
        threadId: t.threadId,
        channelId: t.channelId,
        agentId: t.agentId,
        targetSessionKey: t.targetSessionKey,
        targetKind: t.targetKind,
        boundAt: t.boundAt,
        lastActivityAt: t.lastActivityAt,
        accountId: t.accountId,
        boundBy: t.boundBy,
        label: t.label,
      })),
    });
  },
};
