"use client";

import { Loader2, Package, Plug, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deckFetch } from "@/lib/deck-client";
import { useSessionsStore } from "@/stores/sessions";

interface EffectiveToolsTabProps {
  agentId: string;
}

interface EffectiveTool {
  id: string;
  label: string;
  description: string;
  source: "core" | "plugin" | "channel";
  pluginId?: string;
  channelId?: string;
}

interface EffectiveToolGroup {
  id: "core" | "plugin" | "channel";
  label: string;
  source: "core" | "plugin" | "channel";
  tools: EffectiveTool[];
}

interface EffectiveToolsResult {
  agentId: string;
  profile: string;
  groups: EffectiveToolGroup[];
}

const SOURCE_ICON: Record<string, React.ReactNode> = {
  core: <Package size={12} />,
  plugin: <Plug size={12} />,
  channel: <Radio size={12} />,
};

const SOURCE_BADGE: Record<string, string> = {
  core: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  plugin: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  channel: "bg-teal-500/15 text-teal-400 border-teal-500/25",
};

export function EffectiveToolsTab({ agentId }: EffectiveToolsTabProps) {
  const t = useTranslations("agentDetail");
  const { sessions, fetchSessions } = useSessionsStore();
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);
  const [result, setResult] = useState<EffectiveToolsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agentSessions = useMemo(
    () => sessions.filter((s) => s.key.includes(agentId)),
    [sessions, agentId],
  );

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  // Auto-select most recent session when sessions load
  useEffect(() => {
    if (!selectedSessionKey && agentSessions.length > 0) {
      setSelectedSessionKey(agentSessions[0].key);
    }
  }, [agentSessions, selectedSessionKey]);

  // Reset selection when agent changes
  useEffect(() => {
    setSelectedSessionKey(null);
    setResult(null);
  }, [agentId]);

  const fetchEffectiveTools = useCallback(
    async (sessionKey: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await deckFetch("/api/deck/tools-effective", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey, agentId }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: "Request failed" }))) as {
            error?: string;
          };
          setError(err.error ?? t("effectiveTools.fetchFailed"));
          setResult(null);
          return;
        }
        const data = (await res.json()) as EffectiveToolsResult;
        setResult(data);
      } catch {
        setError(t("effectiveTools.fetchFailed"));
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [agentId],
  );

  useEffect(() => {
    if (selectedSessionKey) {
      void fetchEffectiveTools(selectedSessionKey);
    }
  }, [selectedSessionKey, fetchEffectiveTools]);

  const totalTools = result?.groups.reduce((sum, g) => sum + g.tools.length, 0) ?? 0;

  return (
    <div className="space-y-3">
      {/* Session picker + summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedSessionKey ?? ""} onValueChange={setSelectedSessionKey}>
          <SelectTrigger className="w-64 h-8 text-xs bg-[var(--background)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder={t("effectiveTools.selectSession")} />
          </SelectTrigger>
          <SelectContent>
            {agentSessions.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                <span className="font-mono text-[10px] truncate">{s.label || s.key}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {result && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)]"
            >
              {t("effectiveTools.profile")}: {result.profile}
            </Badge>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {t("effectiveTools.totalTools", { count: totalTools })}
            </span>
          </div>
        )}
      </div>

      {/* No sessions */}
      {agentSessions.length === 0 && (
        <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
          {t("effectiveTools.noSessions")}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
          <span className="text-xs text-[var(--muted-foreground)]">
            {t("effectiveTools.loading")}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="bg-[var(--destructive-muted)] border-[var(--destructive)] p-3">
          <span className="text-xs text-[var(--destructive-muted-text)]">{error}</span>
        </Card>
      )}

      {/* Tool groups */}
      {!loading && result && (
        <div className="space-y-3">
          {result.groups.map((group) => (
            <Card
              key={group.id}
              className="bg-[var(--background)] border-[var(--border)] overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--primary)]">{SOURCE_ICON[group.source]}</span>
                <span className="text-xs font-medium text-[var(--foreground)]">{group.label}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] border ${SOURCE_BADGE[group.source] ?? ""}`}
                >
                  {group.source}
                </Badge>
                <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">
                  {group.tools.length}
                </span>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {group.tools.map((tool) => (
                  <div
                    key={tool.id}
                    className="px-4 py-2 hover:bg-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--foreground)]">
                        {tool.label}
                      </span>
                      {tool.pluginId && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-[var(--border)] text-[var(--muted-foreground)]"
                        >
                          {tool.pluginId}
                        </Badge>
                      )}
                      {tool.channelId && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-[var(--border)] text-[var(--muted-foreground)]"
                        >
                          {tool.channelId}
                        </Badge>
                      )}
                    </div>
                    {tool.description && (
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                        {tool.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {result.groups.length === 0 && (
            <div className="py-6 text-center text-xs text-[var(--muted-foreground)]">
              {t("effectiveTools.noTools")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
