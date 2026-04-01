"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { navigateToAgent } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";
import { useDeckAgentsStore, type AgentSubagentConfig } from "@/stores/deck-agents";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalDefaults {
  maxSpawnDepth: number;
  maxChildrenPerAgent: number;
  maxConcurrent: number;
  archiveAfterMinutes: number;
  defaultModel: string;
  defaultThinking: string;
}

const THINKING_LEVELS = ["none", "low", "medium", "high"] as const;

const DEFAULT_VALUES: GlobalDefaults = {
  maxSpawnDepth: 1,
  maxChildrenPerAgent: 5,
  maxConcurrent: 3,
  archiveAfterMinutes: 60,
  defaultModel: "",
  defaultThinking: "low",
};

/**
 * Config tab — global subagent defaults form + per-agent permissions matrix.
 * Uses config.get/config.patch pattern for global settings.
 */
export function ConfigTab() {
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const fetchSubagentConfig = useDeckAgentsStore((s) => s.fetchSubagentConfig);

  const [defaults, setDefaults] = useState<GlobalDefaults>(DEFAULT_VALUES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [agentConfigs, setAgentConfigs] = useState<Map<string, AgentSubagentConfig>>(new Map());

  // Fetch global config + agents on mount
  useEffect(() => {
    void fetchAgents();
    void loadGlobalConfig();
  }, [fetchAgents]);

  // Load per-agent subagent configs when agents change
  useEffect(() => {
    void loadAgentConfigs();
  }, [agents]);

  const loadGlobalConfig = async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const sub = data.config?.subagents;
      if (sub) {
        setDefaults({
          maxSpawnDepth: sub.maxSpawnDepth ?? DEFAULT_VALUES.maxSpawnDepth,
          maxChildrenPerAgent: sub.maxChildrenPerAgent ?? DEFAULT_VALUES.maxChildrenPerAgent,
          maxConcurrent: sub.maxConcurrent ?? DEFAULT_VALUES.maxConcurrent,
          archiveAfterMinutes: sub.archiveAfterMinutes ?? DEFAULT_VALUES.archiveAfterMinutes,
          defaultModel: sub.defaultModel ?? DEFAULT_VALUES.defaultModel,
          defaultThinking: sub.defaultThinking ?? DEFAULT_VALUES.defaultThinking,
        });
      }
    } catch {
      // ignore
    }
  };

  const loadAgentConfigs = async () => {
    const map = new Map<string, AgentSubagentConfig>();
    for (const agent of agents) {
      try {
        const res = await fetch("/api/deck/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "subagents.get", agentId: agent.id }),
        });
        if (res.ok) {
          const config = (await res.json()) as AgentSubagentConfig;
          map.set(agent.id, config);
        }
      } catch {
        // skip
      }
    }
    setAgentConfigs(map);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      // First get latest config + hash
      const getRes = await fetch("/api/config");
      if (!getRes.ok) {
        return;
      }
      const current = await getRes.json();
      const latestHash = current.baseHash ?? "";

      // Patch with updated subagents section
      const patchRes = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseHash: latestHash,
          patch: {
            subagents: {
              maxSpawnDepth: defaults.maxSpawnDepth,
              maxChildrenPerAgent: defaults.maxChildrenPerAgent,
              maxConcurrent: defaults.maxConcurrent,
              archiveAfterMinutes: defaults.archiveAfterMinutes,
              defaultModel: defaults.defaultModel || undefined,
              defaultThinking: defaults.defaultThinking,
            },
          },
        }),
      });
      if (patchRes.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [defaults]);

  const updateField = <K extends keyof GlobalDefaults>(field: K, value: GlobalDefaults[K]) => {
    setDefaults((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4 gap-6">
      {/* Global defaults */}
      <Card className="p-5 bg-[var(--card)] border-[var(--border)]">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">Global Defaults</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--muted-foreground)]">Max Spawn Depth</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={defaults.maxSpawnDepth}
              onChange={(e) => updateField("maxSpawnDepth", parseInt(e.target.value) || 0)}
              className="bg-[var(--background)] border-[var(--border)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--muted-foreground)]">Max Children Per Agent</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={defaults.maxChildrenPerAgent}
              onChange={(e) => updateField("maxChildrenPerAgent", parseInt(e.target.value) || 0)}
              className="bg-[var(--background)] border-[var(--border)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--muted-foreground)]">Max Concurrent</Label>
            <Input
              type="number"
              min={0}
              max={20}
              value={defaults.maxConcurrent}
              onChange={(e) => updateField("maxConcurrent", parseInt(e.target.value) || 0)}
              className="bg-[var(--background)] border-[var(--border)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--muted-foreground)]">Archive After (min)</Label>
            <Input
              type="number"
              min={1}
              max={10080}
              value={defaults.archiveAfterMinutes}
              onChange={(e) => updateField("archiveAfterMinutes", parseInt(e.target.value) || 60)}
              className="bg-[var(--background)] border-[var(--border)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--muted-foreground)]">Default Model</Label>
            <Input
              value={defaults.defaultModel}
              onChange={(e) => updateField("defaultModel", e.target.value)}
              placeholder="e.g. claude-sonnet-4-20250514"
              className="bg-[var(--background)] border-[var(--border)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--muted-foreground)]">Default Thinking</Label>
            <Select
              value={defaults.defaultThinking}
              onValueChange={(v) => updateField("defaultThinking", v ?? "low")}
            >
              <SelectTrigger className="bg-[var(--background)] border-[var(--border)] cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THINKING_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={() => void handleSave()} disabled={saving} className="cursor-pointer">
            {saving ? "Saving..." : "Save"}
          </Button>
          {saved && <span className="text-xs text-emerald-400">Saved</span>}
        </div>
      </Card>

      {/* Per-agent permissions matrix */}
      <Card className="p-5 bg-[var(--card)] border-[var(--border)]">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">Per-Agent Permissions</h3>
        {agents.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">No agents configured</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                    Agent
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                    Allowed Subagents
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                    Eff. Depth
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                    Eff. Concurrency
                  </th>
                  <th className="text-left py-2 font-medium text-[var(--muted-foreground)]">
                    Model
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const config = agentConfigs.get(agent.id);
                  return (
                    <tr
                      key={agent.id}
                      className={cn(
                        "border-b border-[var(--border-subtle)] hover:bg-[var(--muted)] transition-colors cursor-pointer",
                      )}
                      onClick={() => {
                        void fetchSubagentConfig(agent.id);
                        navigateToAgent(agent.id, "subagent");
                      }}
                    >
                      <td className="py-2.5 pr-4">
                        <AgentBadge agentId={agent.id} agentName={agent.name} />
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--foreground)]">
                        {config?.allowMode === "none"
                          ? "None"
                          : config?.allowMode === "any"
                            ? "Any"
                            : config?.allowAgents?.join(", ") || "—"}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-[var(--muted-foreground)]">
                        {config?.effectiveMaxDepth ?? defaults.maxSpawnDepth}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-[var(--muted-foreground)]">
                        {config?.effectiveMaxChildren ?? defaults.maxChildrenPerAgent}
                      </td>
                      <td className="py-2.5 text-[var(--muted-foreground)]">
                        {config?.model ?? (defaults.defaultModel || "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
