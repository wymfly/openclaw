"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
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

  // Sync model when agent changes.
  useEffect(() => {
    if (agent) {
      setModel(agent.model);
    }
  }, [agent]);

  // Load SOUL.md content.
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
        // Gateway returns { content: "..." } or a string.
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
      await fetch(`/api/agents/${encodeURIComponent(agentId)}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: SOUL_PATH, content: soul }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [agentId, soul]);

  if (!agent) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--text-secondary)" }}
      >
        <p className="text-sm">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {agent.name}
        </h2>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          ID: {agent.id}
        </span>
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        {/* Model selector */}
        <div>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("model")}
          </label>
          <select
            value={model}
            onChange={(e) => void handleModelChange(e.target.value)}
            className="w-full max-w-sm text-xs rounded px-2 py-1.5"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {/* Include current model if not in preset list */}
            {model && !MODELS.includes(model) && <option value={model}>{model}</option>}
          </select>
        </div>

        {/* Status */}
        <div>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("status")}
          </label>
          <span className="text-xs" style={{ color: "var(--text-primary)" }}>
            {t(agent.status)}
          </span>
        </div>

        {/* SOUL.md editor */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              {t("personality")} ({SOUL_PATH})
            </label>
            <button
              onClick={() => void handleSaveSoul()}
              disabled={saving || soulLoading}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
            >
              <Save size={12} />
              {saved ? t("saved") : tc("save")}
            </button>
          </div>
          <textarea
            value={soulLoading ? "" : soul}
            onChange={(e) => setSoul(e.target.value)}
            disabled={soulLoading}
            placeholder={soulLoading ? tc("loading") : t("soulPlaceholder")}
            className="flex-1 min-h-[200px] text-xs rounded px-3 py-2 resize-none font-mono"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
