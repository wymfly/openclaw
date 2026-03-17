"use client";

import { Plus, Trash2, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAgentsStore } from "@/stores/agents";

const STATUS_COLORS: Record<string, string> = {
  idle: "var(--status-connected)",
  busy: "var(--accent)",
  error: "var(--status-disconnected)",
  offline: "var(--text-secondary)",
};

export function AgentList() {
  const t = useTranslations("agents");
  const tc = useTranslations("common");
  const { agents, selectedAgentId, loading, selectAgent, createAgent, deleteAgent } =
    useAgentsStore();

  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    setCreating(true);
    try {
      await createAgent(name);
      setNewName("");
      setShowDialog(false);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteAgent(id);
  };

  return (
    <aside
      className="flex flex-col w-56 shrink-0 border-r h-full"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      {/* New agent button */}
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b hover:opacity-80 transition-opacity"
        style={{ borderColor: "var(--border)", color: "var(--accent)" }}
      >
        <Plus size={14} />
        {t("create")}
      </button>

      {/* Create dialog */}
      {showDialog && (
        <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleCreate();
              }
            }}
            placeholder={t("namePlaceholder")}
            autoFocus
            className="w-full text-xs rounded px-2 py-1.5 mb-1.5"
            style={{
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
          <div className="flex gap-1">
            <button
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || creating}
              className="flex-1 text-xs px-2 py-1 rounded disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)", color: "#fff" }}
            >
              {tc("create")}
            </button>
            <button
              onClick={() => {
                setShowDialog(false);
                setNewName("");
              }}
              className="flex-1 text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              {tc("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto">
        {loading && agents.length === 0 && (
          <div className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            {tc("loading")}
          </div>
        )}
        {agents.map((agent) => {
          const isActive = selectedAgentId === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-primary)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bot size={14} className="shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate w-full text-left">{agent.name}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: STATUS_COLORS[agent.status] ?? "var(--text-secondary)",
                      }}
                    />
                    <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      {agent.model}
                    </span>
                  </div>
                </div>
              </div>
              <span
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
                onClick={(e) => void handleDelete(agent.id, e)}
                role="button"
                tabIndex={-1}
                style={{ color: "var(--text-secondary)" }}
              >
                <Trash2 size={12} />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
