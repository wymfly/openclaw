"use client";

import { Route, Zap, GitBranch, MessageSquare, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AgentDetail } from "@/stores/deck-agents";

type TabValue = "overview" | "routing" | "skills" | "subagent" | "sessions";

interface OverviewTabProps {
  detail: AgentDetail;
  onNavigateTab: (tab: TabValue) => void;
}

interface StatCardDef {
  label: string;
  value: number;
  icon: React.ReactNode;
  tab: TabValue;
  color: string;
}

export function OverviewTab({ detail, onNavigateTab }: OverviewTabProps) {
  const t = useTranslations("agentDetail");
  const stats = detail.stats;

  const statCards: StatCardDef[] = [
    {
      label: t("statBindings"),
      value: stats?.bindingCount ?? 0,
      icon: <Route size={14} />,
      tab: "routing",
      color: "text-blue-400",
    },
    {
      label: t("statSkills"),
      value: stats?.skillCount ?? 0,
      icon: <Zap size={14} />,
      tab: "skills",
      color: "text-amber-400",
    },
    {
      label: t("statSubagents"),
      value: stats?.subagentCount ?? 0,
      icon: <GitBranch size={14} />,
      tab: "subagent",
      color: "text-purple-400",
    },
    {
      label: t("statSessions"),
      value: stats?.activeSessionCount ?? 0,
      icon: <MessageSquare size={14} />,
      tab: "sessions",
      color: "text-teal-400",
    },
    {
      label: t("statActiveRuns"),
      value: stats?.activeRunCount ?? 0,
      icon: <Play size={14} />,
      tab: "subagent",
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Basic info card */}
      <Card className="bg-[var(--bg-primary)] border-[var(--border)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">{t("info")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <dt className="text-[var(--text-secondary)]">{t("id")}</dt>
              <dd className="font-mono text-[var(--text-primary)] mt-0.5">{detail.id}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">{t("name")}</dt>
              <dd className="text-[var(--text-primary)] mt-0.5">{detail.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">{t("workspace")}</dt>
              <dd className="font-mono text-[var(--text-primary)] mt-0.5">
                {detail.workspace || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-secondary)]">{t("model")}</dt>
              <dd className="font-mono text-[var(--text-primary)] mt-0.5">{detail.model || "—"}</dd>
            </div>
            {detail.isDefault && (
              <div className="col-span-2">
                <Badge className="text-[10px] border-0 bg-[var(--accent-muted)] text-[var(--accent)]">
                  {t("defaultAgent")}
                </Badge>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {statCards.map((card) => (
          <button
            key={card.tab + card.label}
            onClick={() => onNavigateTab(card.tab)}
            className="text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 rounded-lg"
          >
            <Card className="bg-[var(--bg-primary)] border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors h-full">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={card.color}>{card.icon}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>
                <span className="text-xl font-semibold text-[var(--text-primary)] tabular-nums">
                  {card.value}
                </span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
