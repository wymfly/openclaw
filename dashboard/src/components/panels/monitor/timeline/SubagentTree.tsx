"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { LineageTree } from "@/components/shared/LineageTree";
import type { LineageNode } from "@/stores/deck-subagents";
import type { RunEventRow } from "@/stores/monitor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set(["active", "completed", "failed", "timeout"]);

function parseSubagentNodes(events: RunEventRow[]): LineageNode[] {
  const subagentEvents = events.filter((e) => e.kind === "subagent");
  if (subagentEvents.length === 0) {
    return [];
  }

  const nodes: LineageNode[] = [];
  const seen = new Set<string>();

  for (const row of subagentEvents) {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      continue;
    }

    const runId =
      (payload.runId as string | undefined) ??
      (payload.childRunId as string | undefined) ??
      String(row.id);

    // Deduplicate by runId
    if (seen.has(runId)) {
      continue;
    }
    seen.add(runId);

    const rawStatus = (payload.status as string | undefined) ?? "active";
    const status = VALID_STATUSES.has(rawStatus) ? (rawStatus as LineageNode["status"]) : "active";

    nodes.push({
      runId,
      sessionKey:
        (payload.sessionKey as string | undefined) ??
        (payload.childSessionKey as string | undefined) ??
        row.sessionKey,
      agentId:
        (payload.agentId as string | undefined) ??
        (payload.childAgentId as string | undefined) ??
        row.agentId,
      agentName:
        (payload.agentName as string | undefined) ?? (payload.childAgentName as string | undefined),
      task: payload.task as string | undefined,
      depth: typeof payload.depth === "number" ? payload.depth : 0,
      parentRunId: (payload.parentRunId as string | undefined) ?? null,
      status,
      durationMs: typeof payload.durationMs === "number" ? payload.durationMs : undefined,
    });
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SubagentTreeProps {
  events: RunEventRow[];
  sessionKey: string;
}

export function SubagentTree({ events, sessionKey }: SubagentTreeProps) {
  const t = useTranslations("monitor");
  const nodes = useMemo(() => parseSubagentNodes(events), [events]);

  // Don't render section at all if no subagent events
  if (nodes.length === 0) {
    return null;
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
        {t("timeline.subagentLineage")}
      </h4>
      <LineageTree nodes={nodes} rootSessionKey={sessionKey} />
    </div>
  );
}
