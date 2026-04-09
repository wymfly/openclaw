"use client";

import { useCallback, useEffect, useState } from "react";
import { computeConfigDiff, type DiffEntry } from "@/lib/config-diff";

interface AgentDetail {
  [key: string]: unknown;
}

interface UseAgentCompareResult {
  left: AgentDetail | undefined;
  right: AgentDetail | undefined;
  diffs: DiffEntry[];
  loading: boolean;
  error: string | null;
}

async function fetchAgentDetail(agentId: string): Promise<AgentDetail> {
  const res = await fetch(`/api/deck/agents?agentId=${encodeURIComponent(agentId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((body as { error?: string }).error ?? "Failed to fetch agent");
  }
  return (await res.json()) as AgentDetail;
}

export function useAgentCompare(
  leftId: string | null,
  rightId: string | null,
): UseAgentCompareResult {
  const [left, setLeft] = useState<AgentDetail | undefined>();
  const [right, setRight] = useState<AgentDetail | undefined>();
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = useCallback(async () => {
    if (!leftId || !rightId) {
      setLeft(undefined);
      setRight(undefined);
      setDiffs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [leftData, rightData] = await Promise.all([
        fetchAgentDetail(leftId),
        fetchAgentDetail(rightId),
      ]);
      setLeft(leftData);
      setRight(rightData);
      setDiffs(computeConfigDiff(leftData, rightData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }, [leftId, rightId]);

  useEffect(() => {
    void compare();
  }, [compare]);

  return { left, right, diffs, loading, error };
}
