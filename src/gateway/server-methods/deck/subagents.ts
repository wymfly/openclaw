import { listAgentEntries } from "../../../agents/agent-scope.js";
import {
  getSubagentRunsForDeck,
  markSubagentRunTerminated,
} from "../../../agents/subagent-registry.js";
import type { SubagentRunRecord } from "../../../agents/subagent-registry.types.js";
import { loadConfig } from "../../../config/config.js";
import { getSubagentDepth, resolveAgentIdFromSessionKey } from "../../../routing/session-key.js";
import {
  validateDeckSubagentsKillParams,
  validateDeckSubagentsLineageParams,
  validateDeckSubagentsListParams,
} from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";

const MAX_LINEAGE_NODES = 50;

function deriveStatus(run: SubagentRunRecord): "active" | "completed" | "failed" | "timeout" {
  if (typeof run.endedAt !== "number") {
    return "active";
  }
  if (run.outcome?.status === "timeout") {
    return "timeout";
  }
  if (run.outcome?.status === "error") {
    return "failed";
  }
  return "completed";
}

function resolveAgentName(cfg: ReturnType<typeof loadConfig>, agentId: string): string | undefined {
  const entry = listAgentEntries(cfg).find((a) => a.id.toLowerCase() === agentId.toLowerCase());
  return entry?.name?.trim() || undefined;
}

function computeDurationMs(run: SubagentRunRecord): number | undefined {
  const start = run.startedAt ?? run.createdAt;
  if (typeof run.endedAt === "number") {
    return Math.max(0, run.endedAt - start);
  }
  return undefined;
}

export const deckSubagentsHandlers: GatewayRequestHandlers = {
  "deck.subagents.list": ({ params, respond }) => {
    if (!validateDeckSubagentsListParams(params)) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "invalid params" });
      return;
    }

    const cfg = loadConfig();
    const allRuns = getSubagentRunsForDeck();
    const statusFilter = (params.status as string) ?? "all";
    const agentIdFilter = params.agentId as string | undefined;
    const requesterAgentIdFilter = params.requesterAgentId as string | undefined;
    const limit = (params.limit as number) ?? 50;
    const offset = (params.offset as number) ?? 0;

    const filtered: SubagentRunRecord[] = [];
    for (const run of allRuns.values()) {
      const status = deriveStatus(run);
      if (statusFilter !== "all" && status !== statusFilter) {
        continue;
      }

      if (agentIdFilter) {
        const childAgentId = resolveAgentIdFromSessionKey(run.childSessionKey);
        if (childAgentId.toLowerCase() !== agentIdFilter.toLowerCase()) {
          continue;
        }
      }

      if (requesterAgentIdFilter) {
        const reqAgentId = resolveAgentIdFromSessionKey(run.requesterSessionKey);
        if (reqAgentId.toLowerCase() !== requesterAgentIdFilter.toLowerCase()) {
          continue;
        }
      }

      filtered.push(run);
    }

    filtered.sort((a, b) => b.createdAt - a.createdAt);
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    const runs = paginated.map((run) => {
      const childAgentId = resolveAgentIdFromSessionKey(run.childSessionKey);
      const requesterAgentId = resolveAgentIdFromSessionKey(run.requesterSessionKey);
      return {
        runId: run.runId,
        childSessionKey: run.childSessionKey,
        childAgentId,
        childAgentName: resolveAgentName(cfg, childAgentId),
        requesterSessionKey: run.requesterSessionKey,
        requesterAgentId,
        requesterAgentName: resolveAgentName(cfg, requesterAgentId),
        task: run.task,
        label: run.label,
        model: run.model,
        spawnMode: run.spawnMode ?? "run",
        depth: getSubagentDepth(run.childSessionKey),
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        durationMs: computeDurationMs(run),
        status: deriveStatus(run),
        outcome: run.outcome,
      };
    });

    respond(true, { runs, total });
  },

  "deck.subagents.kill": ({ params, respond }) => {
    if (!validateDeckSubagentsKillParams(params)) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "invalid params" });
      return;
    }

    const runId = params.runId as string;
    const allRuns = getSubagentRunsForDeck();
    const entry = allRuns.get(runId);

    if (!entry) {
      respond(false, undefined, { code: "NOT_FOUND", message: `run "${runId}" not found` });
      return;
    }

    const childSessionKey = entry.childSessionKey;
    markSubagentRunTerminated({ runId });

    respond(true, { ok: true, runId, childSessionKey });
  },

  "deck.subagents.lineage": ({ params, respond }) => {
    if (!validateDeckSubagentsLineageParams(params)) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "invalid params" });
      return;
    }

    const runId = params.runId as string | undefined;
    const sessionKey = params.sessionKey as string | undefined;

    if (!runId && !sessionKey) {
      respond(false, undefined, {
        code: "INVALID_REQUEST",
        message: "either runId or sessionKey is required",
      });
      return;
    }

    const cfg = loadConfig();
    const allRuns = getSubagentRunsForDeck();

    // 1. Find starting session key
    let startSessionKey: string | undefined;
    if (runId) {
      const run = allRuns.get(runId);
      if (run) {
        startSessionKey = run.childSessionKey;
      }
    }
    if (!startSessionKey && sessionKey) {
      startSessionKey = sessionKey;
    }
    if (!startSessionKey) {
      respond(false, undefined, { code: "NOT_FOUND", message: "run or session not found" });
      return;
    }

    // 2. Walk UPWARD to root via requesterSessionKey chain
    let rootSessionKey = startSessionKey;
    const upVisited = new Set<string>([rootSessionKey]);

    while (true) {
      let parentRun: SubagentRunRecord | undefined;
      for (const run of allRuns.values()) {
        if (run.childSessionKey === rootSessionKey) {
          parentRun = run;
          break;
        }
      }
      if (!parentRun) {
        break;
      }
      const nextKey = parentRun.requesterSessionKey;
      if (upVisited.has(nextKey)) {
        break;
      }
      upVisited.add(nextKey);
      rootSessionKey = nextKey;
    }

    // 3. Walk DOWNWARD from root, collecting all descendant runs (BFS)
    const descendants: SubagentRunRecord[] = [];
    const depthBySessionKey = new Map<string, number>();
    depthBySessionKey.set(rootSessionKey, 0);
    const downQueue = [rootSessionKey];
    const downVisited = new Set<string>([rootSessionKey]);

    for (let i = 0; i < downQueue.length && descendants.length < MAX_LINEAGE_NODES; i++) {
      const current = downQueue[i];
      const currentDepth = depthBySessionKey.get(current) ?? 0;

      for (const run of allRuns.values()) {
        if (run.requesterSessionKey !== current) {
          continue;
        }
        descendants.push(run);
        const childDepth = currentDepth + 1;
        depthBySessionKey.set(run.childSessionKey, childDepth);

        if (descendants.length >= MAX_LINEAGE_NODES) {
          break;
        }
        if (!downVisited.has(run.childSessionKey)) {
          downVisited.add(run.childSessionKey);
          downQueue.push(run.childSessionKey);
        }
      }
    }

    // 4. Build response with parentRunId reconstruction
    const rootAgentId = resolveAgentIdFromSessionKey(rootSessionKey);

    const nodes = descendants.map((run) => {
      // parentRunId: find the run whose childSessionKey === this run's requesterSessionKey
      let parentRunId: string | null = null;
      for (const other of allRuns.values()) {
        if (other.childSessionKey === run.requesterSessionKey) {
          parentRunId = other.runId;
          break;
        }
      }

      const agentId = resolveAgentIdFromSessionKey(run.childSessionKey);
      return {
        runId: run.runId,
        sessionKey: run.childSessionKey,
        agentId,
        agentName: resolveAgentName(cfg, agentId),
        task: run.task,
        depth: depthBySessionKey.get(run.childSessionKey) ?? getSubagentDepth(run.childSessionKey),
        parentRunId,
        status: deriveStatus(run),
        durationMs: computeDurationMs(run),
      };
    });

    respond(true, {
      root: {
        sessionKey: rootSessionKey,
        agentId: rootAgentId,
        agentName: resolveAgentName(cfg, rootAgentId),
      },
      nodes,
    });
  },
};
