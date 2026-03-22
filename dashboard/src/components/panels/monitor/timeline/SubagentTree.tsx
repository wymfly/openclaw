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
  const subagentEvents = events.filter((e) => e.stream === "subagent");
  if (subagentEvents.length === 0) {
    return [];
  }

  const nodes: LineageNode[] = [];
  const seen = new Set<string>();

  for (const row of subagentEvents) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      continue;
    }

    const runId =
      (parsed.runId as string | undefined) ??
      (parsed.childRunId as string | undefined) ??
      String(row.id);

    // Deduplicate by runId
    if (seen.has(runId)) {
      continue;
    }
    seen.add(runId);

    const rawStatus = (parsed.status as string | undefined) ?? "active";
    const status = VALID_STATUSES.has(rawStatus) ? (rawStatus as LineageNode["status"]) : "active";

    nodes.push({
      runId,
      sessionKey:
        (parsed.sessionKey as string | undefined) ??
        (parsed.childSessionKey as string | undefined) ??
        row.session_key ??
        "",
      agentId:
        (parsed.agentId as string | undefined) ??
        (parsed.childAgentId as string | undefined) ??
        row.agent_id ??
        "",
      agentName:
        (parsed.agentName as string | undefined) ?? (parsed.childAgentName as string | undefined),
      task: parsed.task as string | undefined,
      depth: typeof parsed.depth === "number" ? parsed.depth : 0,
      parentRunId: (parsed.parentRunId as string | undefined) ?? null,
      status,
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : undefined,
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
