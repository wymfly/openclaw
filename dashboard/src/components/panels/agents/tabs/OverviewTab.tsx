"use client";

import {
  Route,
  Zap,
  GitBranch,
  MessageSquare,
  Play,
  Layers,
  Shield,
  Cpu,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { navigateToSubagents } from "@/lib/panel-navigation";
import { useDeckAgentsStore, type AgentDetail } from "@/stores/deck-agents";
import { ChannelEventStreamSection } from "./ChannelEventStreamSection";

type TabValue = "overview" | "routing" | "skills" | "context" | "subagent" | "sessions";

interface OverviewTabProps {
  detail: AgentDetail;
  onNavigateTab: (tab: TabValue) => void;
}

interface StatCardDef {
  label: string;
  value: number;
  icon: React.ReactNode;
  tab?: TabValue;
  /** If set, navigates to a different panel instead of switching tabs. */
  panelAction?: () => void;
  color: string;
}

export function OverviewTab({ detail, onNavigateTab }: OverviewTabProps) {
  const t = useTranslations("agentDetail");
  const { agentIdentity, fetchIdentity } = useDeckAgentsStore();

  useEffect(() => {
    void fetchIdentity(detail.id);
  }, [detail.id, fetchIdentity]);

  const statCards: StatCardDef[] = [
    {
      label: t("statBindings"),
      value: detail.bindingCount ?? 0,
      icon: <Route size={14} />,
      tab: "routing",
      color: "text-blue-400",
    },
    {
      label: t("statSkills"),
      value: detail.effectiveSkills?.length ?? 0,
      icon: <Zap size={14} />,
      tab: "skills",
      color: "text-amber-400",
    },
    {
      label: t("statSubagents"),
      value: detail.activeSubagentCount ?? 0,
      icon: <GitBranch size={14} />,
      tab: "subagent",
      color: "text-purple-400",
    },
    {
      label: t("statSessions"),
      value: detail.sessionCount ?? 0,
      icon: <MessageSquare size={14} />,
      tab: "sessions",
      color: "text-teal-400",
    },
    {
      label: t("statActiveRuns"),
      value: 0,
      icon: <Play size={14} />,
      panelAction: navigateToSubagents,
      color: "text-emerald-400",
    },
    {
      label: t("statContext"),
      value: 0,
      icon: <Layers size={14} />,
      tab: "context",
      color: "text-indigo-400",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Basic info card */}
      <Card className="bg-[var(--background)] border-[var(--border)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs">{t("info")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="min-w-0">
              <dt className="text-[var(--muted-foreground)]">{t("id")}</dt>
              <dd className="font-mono text-[var(--foreground)] mt-0.5 truncate">{detail.id}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[var(--muted-foreground)]">{t("name")}</dt>
              <dd className="text-[var(--foreground)] mt-0.5 truncate">
                {detail.name || detail.id}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[var(--muted-foreground)]">{t("workspace")}</dt>
              <dd className="font-mono text-[var(--foreground)] mt-0.5 truncate">
                {detail.workspace || "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[var(--muted-foreground)]">{t("model")}</dt>
              <dd className="font-mono text-[var(--foreground)] mt-0.5 truncate">
                {detail.model || "—"}
              </dd>
            </div>
            {detail.isDefault && (
              <div className="col-span-2">
                <Badge className="text-[10px] border-0 bg-[var(--primary-muted)] text-[var(--primary)]">
                  {t("defaultAgent")}
                </Badge>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Sandbox & Model */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Card className="bg-[var(--background)] border-[var(--border)]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs">
              <Shield size={14} className="text-[var(--primary)]" />
              <span className="text-[var(--muted-foreground)]">{t("sandboxMode")}</span>
            </div>
            <p className="text-xs text-[var(--foreground)] mt-1">
              {(() => {
                const sandboxMode =
                  detail.sandbox &&
                  typeof detail.sandbox === "object" &&
                  "mode" in (detail.sandbox as Record<string, unknown>)
                    ? (detail.sandbox as { mode?: string }).mode
                    : undefined;
                return sandboxMode && sandboxMode !== "off"
                  ? t("sandboxEnabled")
                  : t("sandboxDefault");
              })()}
            </p>
            {detail.sandbox && typeof detail.sandbox === "object"
              ? (() => {
                  const sb = detail.sandbox as Record<string, unknown>;
                  const elevation = typeof sb.elevation === "string" ? sb.elevation : undefined;
                  const filesystem = typeof sb.filesystem === "string" ? sb.filesystem : undefined;
                  if (!elevation && !filesystem) {
                    return null;
                  }
                  return (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      {elevation ? (
                        <div>
                          <dt className="text-[var(--muted-foreground)]">
                            {t("sandboxElevation")}
                          </dt>
                          <dd className="text-[var(--foreground)] capitalize">
                            {elevation === "elevated" ? t("sandboxElevated") : t("sandboxStandard")}
                          </dd>
                        </div>
                      ) : null}
                      {filesystem ? (
                        <div>
                          <dt className="text-[var(--muted-foreground)]">
                            {t("sandboxFilesystem")}
                          </dt>
                          <dd className="text-[var(--foreground)] capitalize">
                            {filesystem === "restricted" ? t("sandboxRestricted") : filesystem}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  );
                })()
              : null}
          </CardContent>
        </Card>

        <Card className="bg-[var(--background)] border-[var(--border)]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-xs">
              <Cpu size={14} className="text-[var(--primary)]" />
              <span className="text-[var(--muted-foreground)]">{t("modelConfig")}</span>
            </div>
            <p className="font-mono text-xs text-[var(--foreground)] mt-1">
              {detail.model || t("usingDefault")}
            </p>
            {detail.fallbackModels && detail.fallbackModels.length > 0 && (
              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                {t("fallbacks")}: {detail.fallbackModels.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Identity preview — enhanced with agent.identity.get data */}
      <Card className="bg-[var(--background)] border-[var(--border)]">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs mb-2">
            <User size={14} className="text-[var(--primary)]" />
            <span className="text-[var(--muted-foreground)]">{t("identity")}</span>
            {detail.identityExists && (
              <Badge variant="secondary" className="text-[10px]">
                IDENTITY.md
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {agentIdentity?.avatar ? (
              <img
                src={agentIdentity.avatar}
                alt={t("avatarAlt")}
                className="w-10 h-10 rounded-xl ring-1 ring-[var(--primary)]/20 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-muted)] flex items-center justify-center text-lg ring-1 ring-[var(--primary)]/20">
                {agentIdentity?.emoji ??
                  (detail.name || detail.id)?.charAt(0)?.toUpperCase() ??
                  "?"}
              </div>
            )}
            <div className="text-xs">
              <p className="text-[var(--foreground)] font-medium">
                {agentIdentity?.name || detail.name || detail.id}
              </p>
              {agentIdentity?.emoji && (
                <span className="text-[var(--muted-foreground)]">{agentIdentity.emoji}</span>
              )}
              <button
                onClick={() => onNavigateTab("context")}
                className="block text-[var(--primary)] hover:underline cursor-pointer mt-0.5"
              >
                {t("configureIdentity")}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {statCards.map((card) => (
          <button
            key={(card.tab ?? "panel") + card.label}
            onClick={() => {
              if (card.panelAction) {
                card.panelAction();
              } else if (card.tab) {
                onNavigateTab(card.tab);
              }
            }}
            className="text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 rounded-lg"
          >
            <Card className="bg-[var(--background)] border-[var(--border)] hover:border-[var(--primary)]/30 transition-colors h-full">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={card.color}>{card.icon}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>
                <span className="text-xl font-semibold text-[var(--foreground)] tabular-nums">
                  {card.value}
                </span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Channel Event Streams */}
      <ChannelEventStreamSection agentId={detail.id} />
    </div>
  );
}
