import crypto from "node:crypto";
import { createHash } from "node:crypto";
import { AGENT_LANE_SUBAGENT } from "../../../agents/lanes.js";
import { abortEmbeddedPiRun } from "../../../agents/pi-embedded.js";
import {
  clearSubagentRunSteerRestart,
  getSubagentRunsForDeck,
  markSubagentRunForSteerRestart,
  replaceSubagentRunAfterSteer,
} from "../../../agents/subagent-registry.js";
import { clearSessionQueues } from "../../../auto-reply/reply/queue.js";
import { loadConfig } from "../../../config/config.js";
import { loadSessionStore, resolveStorePath } from "../../../config/sessions.js";
import { callGateway } from "../../../gateway/call.js";
import { parseAgentSessionKey } from "../../../routing/session-key.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../../../utils/message-channel.js";
import { validateDeckSubagentsSteerParams } from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";

// ---------------------------------------------------------------------------
// In-memory dedup map: sha256(runId + ":" + instruction) → expiresAt (ms)
// ---------------------------------------------------------------------------

const DEDUP_TTL_MS = 60_000;
const SWEEP_INTERVAL_MS = 60_000;
const STEER_ABORT_SETTLE_TIMEOUT_MS = 5_000;

const dedupMap = new Map<string, number>();
let sweepTimer: ReturnType<typeof setInterval> | undefined;

function ensureSweepTimer() {
  if (sweepTimer !== undefined) {
    return;
  }
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, expiresAt] of dedupMap) {
      if (expiresAt <= now) {
        dedupMap.delete(key);
      }
    }
    if (dedupMap.size === 0 && sweepTimer !== undefined) {
      clearInterval(sweepTimer);
      sweepTimer = undefined;
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof sweepTimer === "object" && "unref" in sweepTimer) {
    sweepTimer.unref();
  }
}

function computeDedupKey(runId: string, instruction: string): string {
  return createHash("sha256").update(`${runId}:${instruction}`).digest("hex");
}

/** Resolve the Pi session ID for a given session key (needed for abort). */
function resolveSessionId(childSessionKey: string): string | undefined {
  const cfg = loadConfig();
  const parsed = parseAgentSessionKey(childSessionKey);
  if (!parsed) {
    return undefined;
  }
  const storePath = resolveStorePath(cfg.session?.store, { agentId: parsed.agentId });
  const store = loadSessionStore(storePath);
  const entry = store[childSessionKey];
  return typeof entry?.sessionId === "string" && entry.sessionId.trim()
    ? entry.sessionId.trim()
    : undefined;
}

// Exported for tests
export function resetSteerDedupForTests() {
  dedupMap.clear();
  if (sweepTimer !== undefined) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const deckSubagentsSteerHandlers: GatewayRequestHandlers = {
  "deck.subagents.steer": async ({ params, respond }) => {
    if (!validateDeckSubagentsSteerParams(params)) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "invalid params" });
      return;
    }

    const runId = params.runId as string;
    const instruction = params.instruction as string;

    // 1. Look up run in registry
    const allRuns = getSubagentRunsForDeck();
    const entry = allRuns.get(runId);

    if (!entry) {
      respond(false, undefined, { code: "RUN_NOT_FOUND", message: `run "${runId}" not found` });
      return;
    }

    // 2. Check if run is active (no endedAt)
    if (typeof entry.endedAt === "number") {
      respond(false, undefined, {
        code: "RUN_NOT_ACTIVE",
        message: `run "${runId}" is not active`,
      });
      return;
    }

    // 3. Compute dedup key and check for recent duplicate
    const dedupKey = computeDedupKey(runId, instruction);
    const now = Date.now();
    const existingExpiry = dedupMap.get(dedupKey);

    if (existingExpiry !== undefined && existingExpiry > now) {
      respond(true, { success: true, deduped: true, dedupKey });
      return;
    }

    // 4. Store dedup entry with TTL
    dedupMap.set(dedupKey, now + DEDUP_TTL_MS);
    ensureSweepTimer();

    // 5. Execute full steer-restart flow
    // (replicates src/agents/tools/subagents-tool.ts:600-681)

    // 5a. Suppress announce for the interrupted run
    markSubagentRunForSteerRestart(runId);

    // 5b. Resolve session ID for abort
    const sessionId = resolveSessionId(entry.childSessionKey);

    // 5c. Abort current Pi run + clear queues
    if (sessionId) {
      abortEmbeddedPiRun(sessionId);
    }
    clearSessionQueues([entry.childSessionKey, sessionId]);

    // 5d. Wait for the interrupted run to settle
    try {
      await callGateway({
        method: "agent.wait",
        params: {
          runId,
          timeoutMs: STEER_ABORT_SETTLE_TIMEOUT_MS,
        },
        timeoutMs: STEER_ABORT_SETTLE_TIMEOUT_MS + 2_000,
      });
    } catch {
      // Continue even if wait fails; steer should still be attempted.
    }

    // 5e. Launch new run with the instruction as message
    const idempotencyKey = crypto.randomUUID();
    let newRunId: string = idempotencyKey;
    try {
      const response = await callGateway<{ runId: string }>({
        method: "agent",
        params: {
          message: instruction,
          sessionKey: entry.childSessionKey,
          sessionId,
          idempotencyKey,
          deliver: false,
          channel: INTERNAL_MESSAGE_CHANNEL,
          lane: AGENT_LANE_SUBAGENT,
          timeout: 0,
        },
        timeoutMs: 10_000,
      });
      if (typeof response?.runId === "string" && response.runId) {
        newRunId = response.runId;
      }
    } catch {
      // Restart failed; restore normal announce behavior
      clearSubagentRunSteerRestart(runId);
      respond(false, undefined, {
        code: "STEER_FAILED",
        message: "Failed to restart subagent with instruction",
      });
      return;
    }

    // 5f. Replace run record to link old and new
    replaceSubagentRunAfterSteer({
      previousRunId: runId,
      nextRunId: newRunId,
      fallback: entry,
      runTimeoutSeconds: entry.runTimeoutSeconds ?? 0,
    });

    respond(true, { success: true, dedupKey, newRunId });
  },
};
