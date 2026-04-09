"use client";

import { Bot } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAgentsStore } from "@/stores/agents";

interface MentionPopoverProps {
  filter: string;
  onSelect: (agentName: string) => void;
  onDismiss: () => void;
}

/**
 * Dropdown popover shown when user types `@` in the chat input.
 * Lists available agents filtered by the partial name typed after `@`.
 */
export function MentionPopover({ filter, onSelect, onDismiss }: MentionPopoverProps) {
  const t = useTranslations("chat");
  const agents = useAgentsStore((s) => s.agents);

  const filtered = agents.filter((a) =>
    (a.name || a.id).toLowerCase().includes(filter.toLowerCase()),
  );

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-0 mb-1 w-56 max-h-48 overflow-y-auto rounded-lg border shadow-lg z-30"
      style={{
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
      }}
    >
      <div className="px-2 py-1.5 text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
        {t("mentionAgents")}
      </div>
      {filtered.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => {
            onSelect(agent.name || agent.id);
            onDismiss();
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-[var(--accent)] transition-colors"
          style={{ color: "var(--foreground)" }}
        >
          <Bot size={14} className="text-[var(--muted-foreground)] shrink-0" />
          <span className="truncate">{agent.name || agent.id}</span>
        </button>
      ))}
    </div>
  );
}
