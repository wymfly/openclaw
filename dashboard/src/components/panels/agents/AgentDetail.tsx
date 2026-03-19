"use client";

import { Save, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentsStore } from "@/stores/agents";

const MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-2.0-flash",
  "gemini-2.5-pro-preview-06-05",
];

const SOUL_PATH = "SOUL.md";

const STATUS_BADGE: Record<string, string> = {
  idle: "bg-[var(--success-muted)] text-[var(--success-muted-text)]",
  busy: "bg-[var(--accent-muted)] text-[var(--accent)]",
  error: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]",
  offline: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

export function AgentDetail({ agentId }: { agentId: string }) {
  const t = useTranslations("agents");
  const tc = useTranslations("common");
  const { agents, updateAgent } = useAgentsStore();

  const agent = agents.find((a) => a.id === agentId);

  const [model, setModel] = useState(agent?.model ?? "");
  const [soul, setSoul] = useState("");
  const [soulLoading, setSoulLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (agent) {
      setModel(agent.model);
    }
  }, [agent]);

  useEffect(() => {
    setSoulLoading(true);
    setSoul("");
    setSaved(false);
    void fetch(`/api/agents/${encodeURIComponent(agentId)}/files/${SOUL_PATH}`)
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        const content =
          typeof data === "string" ? data : typeof data?.content === "string" ? data.content : "";
        setSoul(content);
      })
      .catch(() => {})
      .finally(() => setSoulLoading(false));
  }, [agentId]);

  const handleModelChange = useCallback(
    async (newModel: string) => {
      setModel(newModel);
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: newModel }),
      });
      if (res.ok) {
        updateAgent(agentId, { model: newModel });
      }
    },
    [agentId, updateAgent],
  );

  const handleSaveSoul = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: SOUL_PATH, content: soul }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [agentId, soul]);

  if (!agent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center ring-1 ring-[var(--border-subtle)]">
          <Bot size={20} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header with agent identity */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border)]">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/20">
          <Bot size={16} className="text-[var(--accent)]" />
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
            {agent.name}
          </h2>
          <span className="text-[10px] font-mono text-[var(--text-secondary)]">{agent.id}</span>
        </div>
        <Badge
          className={`ml-auto shrink-0 text-[10px] border-0 ${STATUS_BADGE[agent.status] ?? STATUS_BADGE.offline}`}
        >
          {t(agent.status ?? "idle")}
        </Badge>
      </div>

      {/* Content sections */}
      <div className="flex-1 p-4 space-y-4">
        {/* Model config card */}
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">{t("model")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={model}
              onValueChange={(val) => {
                if (val) {
                  void handleModelChange(val);
                }
              }}
            >
              <SelectTrigger className="w-full max-w-sm" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    <span className="font-mono text-xs">{m}</span>
                  </SelectItem>
                ))}
                {model && !MODELS.includes(model) && (
                  <SelectItem value={model}>
                    <span className="font-mono text-xs">{model}</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* SOUL.md editor */}
        <Card className="flex flex-col flex-1 min-h-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs">
                {t("personality")}
                <span className="ml-1.5 font-mono text-[var(--text-secondary)] font-normal">
                  {SOUL_PATH}
                </span>
              </CardTitle>
              <Button
                size="xs"
                variant={saved ? "outline" : "default"}
                onClick={() => void handleSaveSoul()}
                disabled={saving || soulLoading}
                className="gap-1"
              >
                <Save size={12} />
                {saved ? t("saved") : tc("save")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <textarea
              value={soulLoading ? "" : soul}
              onChange={(e) => setSoul(e.target.value)}
              disabled={soulLoading}
              placeholder={soulLoading ? tc("loading") : t("soulPlaceholder")}
              className="w-full min-h-[200px] text-xs rounded-lg px-3 py-2.5 resize-none font-mono border border-[var(--border)] bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:border-[var(--accent)] disabled:opacity-50"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
