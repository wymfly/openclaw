"use client";

import { ExternalLink, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { SubagentRunCard } from "@/components/shared/SubagentRunCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { navigateToSubagents } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";
import { useDeckAgentsStore, type AgentSubagentConfig } from "@/stores/deck-agents";
import { useDeckSubagentsStore } from "@/stores/deck-subagents";

interface SubagentTabProps {
  agentId: string;
}

type AllowMode = AgentSubagentConfig["allowMode"];

const MODES: { value: AllowMode; labelKey: string }[] = [
  { value: "none", labelKey: "spawnNone" },
  { value: "list", labelKey: "spawnList" },
  { value: "any", labelKey: "spawnAny" },
];

export function SubagentTab({ agentId }: SubagentTabProps) {
  const t = useTranslations("agentDetail");
  const { currentSubagentConfig, fetchSubagentConfig, updateSubagentConfig } = useDeckAgentsStore();
  const allAgents = useAgentsStore((s) => s.agents);
  const { activeRuns, fetchRuns } = useDeckSubagentsStore();

  const [allowMode, setAllowMode] = useState<AllowMode>("none");
  const [allowAgents, setAllowAgents] = useState<string[]>([]);
  const [modelOverride, setModelOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetchSubagentConfig(agentId);
    void fetchRuns(undefined, agentId);
  }, [agentId, fetchSubagentConfig, fetchRuns]);

  useEffect(() => {
    if (currentSubagentConfig) {
      setAllowMode(currentSubagentConfig.allowMode);
      setAllowAgents(currentSubagentConfig.allowAgents);
      setModelOverride(currentSubagentConfig.model ?? "");
    }
  }, [currentSubagentConfig]);

  const toggleAgent = (id: string) => {
    setAllowAgents((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    const ok = await updateSubagentConfig(
      agentId,
      {
        allowMode,
        allowAgents,
        model: modelOverride || undefined,
      },
      "",
    );
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }, [agentId, allowMode, allowAgents, modelOverride, updateSubagentConfig]);

  // Filter active runs for this agent
  const agentRuns = activeRuns.filter((r) => r.requesterAgentId === agentId);

  return (
    <div className="space-y-4">
      {/* Permission selector */}
      <Card className="p-4 bg-[var(--background)] border-[var(--border)]">
        <Label className="text-xs text-[var(--muted-foreground)] mb-2 block">
          {t("spawnPermission")}
        </Label>
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                setAllowMode(m.value);
                setSaved(false);
              }}
              className={cn(
                "flex-1 px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                allowMode === m.value
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
      </Card>

      {/* Agent checklist (list mode) */}
      {allowMode === "list" && (
        <Card className="p-4 bg-[var(--background)] border-[var(--border)]">
          <div className="space-y-1.5">
            {allAgents
              .filter((a) => a.id !== agentId)
              .map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer",
                    "border border-[var(--border)]",
                    "hover:border-[var(--primary)]/30",
                    allowAgents.includes(agent.id) &&
                      "ring-1 ring-[var(--primary)]/30 border-[var(--primary)]/20",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                      allowAgents.includes(agent.id)
                        ? "bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border-[var(--border)] bg-transparent",
                    )}
                  >
                    {allowAgents.includes(agent.id) && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-[var(--foreground)]">
                    {agent.name || agent.id}
                  </span>
                </button>
              ))}
          </div>
        </Card>
      )}

      {/* Model override */}
      <Card className="p-4 bg-[var(--background)] border-[var(--border)]">
        <Label className="text-xs text-[var(--muted-foreground)] mb-1.5 block">
          {t("modelOverride")}
        </Label>
        <Input
          value={modelOverride}
          onChange={(e) => {
            setModelOverride(e.target.value);
            setSaved(false);
          }}
          placeholder={t("modelOverridePlaceholder")}
          className="text-xs font-mono bg-[var(--muted)]"
        />
      </Card>

      {/* Effective limits (read-only) */}
      <Card className="p-4 bg-[var(--background)] border-[var(--border)]">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-xs">{t("effectiveLimits")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-[var(--muted-foreground)]">{t("maxDepth")}</span>
              <p className="text-sm font-mono text-[var(--foreground)]">
                {currentSubagentConfig?.effectiveMaxDepth ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-[var(--muted-foreground)]">{t("maxChildren")}</span>
              <p className="text-sm font-mono text-[var(--foreground)]">
                {currentSubagentConfig?.effectiveMaxChildren ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--muted-foreground)]">
            <Info size={10} />
            {t("limitsNote")}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving}
          variant={saved ? "outline" : "default"}
          className="cursor-pointer"
        >
          {saved ? t("saveSubagent") + " ✓" : t("saveSubagent")}
        </Button>
      </div>

      {/* Link to subagents panel */}
      <div className="flex justify-end">
        <button
          onClick={navigateToSubagents}
          className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline cursor-pointer"
        >
          {t("viewInSubagentsPanel")}
          <ExternalLink size={10} />
        </button>
      </div>

      {/* Active runs summary */}
      {agentRuns.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-[var(--foreground)]">
            {t("activeRunsSummary")}
            <Badge variant="outline" className="ml-2 text-[10px]">
              {agentRuns.length}
            </Badge>
          </h3>
          {agentRuns.map((run) => (
            <SubagentRunCard key={run.sessionKey} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
