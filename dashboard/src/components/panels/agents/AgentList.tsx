"use client";

import { Plus, Trash2, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";

const STATUS_DOT: Record<string, string> = {
  idle: "bg-[var(--status-connected)]",
  busy: "bg-[var(--accent)]",
  error: "bg-[var(--danger)]",
  offline: "bg-[var(--text-secondary)]",
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
    <aside className="flex flex-col w-56 shrink-0 border-r border-[var(--border)] h-full bg-[var(--bg-secondary)]">
      {/* New agent action */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="justify-start gap-1.5 mx-2 mt-2.5 mb-1 text-[var(--accent)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      >
        <Plus size={14} />
        {t("create")}
      </Button>

      {/* Inline create form */}
      {showDialog && (
        <div className="mx-2 mb-1.5 p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleCreate();
              }
            }}
            placeholder={t("namePlaceholder")}
            autoFocus
            className="text-xs mb-2 h-7"
          />
          <div className="flex gap-1.5">
            <Button
              size="xs"
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || creating}
              className="flex-1"
            >
              {tc("create")}
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setShowDialog(false);
                setNewName("");
              }}
              className="flex-1"
            >
              {tc("cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Agent list */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-0.5">
          {loading && agents.length === 0 && (
            <div className="px-3 py-4 text-xs text-[var(--text-secondary)]">{tc("loading")}</div>
          )}
          {agents.map((agent) => {
            const isActive = selectedAgentId === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent.id)}
                className={cn(
                  "relative flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer group",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                    aria-hidden
                  />
                )}

                <div className="flex items-center gap-2 min-w-0">
                  <Bot size={14} className="shrink-0" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate w-full text-left font-medium">{agent.name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cn(
                          "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                          STATUS_DOT[agent.status] ?? "bg-[var(--text-secondary)]",
                        )}
                      />
                      <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                        {agent.model}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete on hover */}
                <span
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 text-[var(--text-secondary)] hover:text-[var(--danger)] cursor-pointer"
                  onClick={(e) => void handleDelete(agent.id, e)}
                  role="button"
                  tabIndex={-1}
                  aria-label="Delete agent"
                >
                  <Trash2 size={12} />
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
