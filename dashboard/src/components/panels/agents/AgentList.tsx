"use client";

import { Plus, Trash2, Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-[var(--status-connected)]",
  busy: "bg-primary",
  error: "bg-destructive",
  offline: "bg-muted-foreground",
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
    <aside className="flex flex-col w-56 shrink-0 border-r h-full bg-card">
      {/* New agent button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="justify-start gap-1.5 rounded-none border-b text-primary"
      >
        <Plus size={14} />
        {t("create")}
      </Button>

      {/* Create dialog */}
      {showDialog && (
        <div className="p-2 border-b">
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
            className="text-xs mb-1.5 h-7"
          />
          <div className="flex gap-1">
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
        {loading && agents.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">{tc("loading")}</div>
        )}
        {agents.map((agent) => {
          const isActive = selectedAgentId === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
              className={cn(
                "flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group cursor-pointer",
                isActive ? "bg-primary/[0.12] text-primary" : "text-foreground hover:bg-muted",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bot size={14} className="shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate w-full text-left">{agent.name}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-block w-1.5 h-1.5 rounded-full",
                        STATUS_COLORS[agent.status] ?? "bg-muted-foreground",
                      )}
                    />
                    <span className="text-[10px] text-muted-foreground">{agent.model}</span>
                  </div>
                </div>
              </div>
              <span
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 text-muted-foreground"
                onClick={(e) => void handleDelete(agent.id, e)}
                role="button"
                tabIndex={-1}
              >
                <Trash2 size={12} />
              </span>
            </button>
          );
        })}
      </ScrollArea>
    </aside>
  );
}
