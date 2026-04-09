"use client";

import { ArrowLeft, GitCompareArrows } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { PanelError } from "@/components/ui/panel-error";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { useAgentCompare } from "@/hooks/useAgentCompare";
import { useAgentsStore } from "@/stores/agents";
import { DiffSection } from "./DiffSection";

interface AgentComparePanelProps {
  initialLeftId?: string | null;
}

export function AgentComparePanel({ initialLeftId }: AgentComparePanelProps) {
  const t = useTranslations("agentCompare");
  const agents = useAgentsStore((s) => s.agents);
  const [leftId, setLeftId] = useState<string | null>(initialLeftId ?? null);
  const [rightId, setRightId] = useState<string | null>(null);
  const { left, right, diffs, loading, error } = useAgentCompare(leftId, rightId);

  const exitCompare = () => useAgentsStore.getState().setCompareAgentId(null);

  if (!leftId || !rightId) {
    return (
      <div className="flex flex-col h-full">
        <CompareHeader onBack={exitCompare} />
        <AgentSelectors
          agents={agents}
          leftId={leftId}
          rightId={rightId}
          onLeftChange={setLeftId}
          onRightChange={setRightId}
        />
        <PanelEmptyState
          icon={<GitCompareArrows size={40} strokeWidth={1.2} />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <CompareHeader onBack={exitCompare} />
      <AgentSelectors
        agents={agents}
        leftId={leftId}
        rightId={rightId}
        onLeftChange={setLeftId}
        onRightChange={setRightId}
      />

      {loading && <PanelSkeleton variant="list" />}
      {error && <PanelError error={error} />}
      {!loading && !error && left && right && (
        <div className="flex-1 overflow-y-auto p-3">
          {diffs.length === 0 ? (
            <p className="text-xs text-center text-[var(--muted-foreground)] py-8">
              {t("identical")}
            </p>
          ) : (
            <DiffSection diffs={diffs} />
          )}
        </div>
      )}
    </div>
  );
}

function AgentSelectors({
  agents,
  leftId,
  rightId,
  onLeftChange,
  onRightChange,
}: {
  agents: { id: string; name: string }[];
  leftId: string | null;
  rightId: string | null;
  onLeftChange: (id: string | null) => void;
  onRightChange: (id: string | null) => void;
}) {
  const t = useTranslations("agentCompare");

  return (
    <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: "var(--border)" }}>
      <AgentSelect label={t("leftAgent")} agents={agents} value={leftId} onChange={onLeftChange} />
      <GitCompareArrows size={16} className="text-[var(--muted-foreground)] shrink-0" />
      <AgentSelect
        label={t("rightAgent")}
        agents={agents}
        value={rightId}
        onChange={onRightChange}
      />
    </div>
  );
}

function AgentSelect({
  label,
  agents,
  value,
  onChange,
}: {
  label: string;
  agents: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="flex-1 px-2 py-1.5 text-xs rounded-md border bg-transparent"
      style={{
        borderColor: "var(--border)",
        color: "var(--foreground)",
        backgroundColor: "var(--background)",
      }}
    >
      <option value="">{label}</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

function CompareHeader({ onBack }: { onBack: () => void }) {
  const t = useTranslations("agentCompare");
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
      style={{ borderColor: "var(--border)" }}
    >
      <button
        type="button"
        onClick={onBack}
        className="p-1 -ml-1 rounded hover:bg-[var(--muted)] transition-colors"
      >
        <ArrowLeft size={16} className="text-[var(--muted-foreground)]" />
      </button>
      <GitCompareArrows size={16} className="text-[var(--primary)]" />
      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {t("title")}
      </span>
    </div>
  );
}
