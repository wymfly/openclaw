import { createHash } from "node:crypto";
import {
  getSubagentRunsForDeck,
  markSubagentRunForSteerRestart,
} from "../../../agents/subagent-registry.js";
import { validateDeckSubagentsSteerParams } from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";

// ---------------------------------------------------------------------------
// In-memory dedup map: sha256(runId + ":" + instruction) → expiresAt (ms)
// ---------------------------------------------------------------------------

const DEDUP_TTL_MS = 60_000;
const SWEEP_INTERVAL_MS = 60_000;

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
    // Stop timer when map is empty to avoid keeping the process alive
    if (dedupMap.size === 0 && sweepTimer !== undefined) {
      clearInterval(sweepTimer);
      sweepTimer = undefined;
    }
  }, SWEEP_INTERVAL_MS);
  // Allow the process to exit even if the timer is active
  if (typeof sweepTimer === "object" && "unref" in sweepTimer) {
    sweepTimer.unref();
  }
}

function computeDedupKey(runId: string, instruction: string): string {
  return createHash("sha256").update(`${runId}:${instruction}`).digest("hex");
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
  "deck.subagents.steer": ({ params, respond }) => {
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

    // 5. Mark the run for steer-restart — the subagent tool loop picks up the flag
    markSubagentRunForSteerRestart(runId);

    respond(true, { success: true, dedupKey });
  },
};
