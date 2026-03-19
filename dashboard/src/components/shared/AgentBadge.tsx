"use client";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";

interface AgentBadgeProps {
  agentId: string;
  agentName?: string;
  emoji?: string;
  onClick?: () => void;
}

/**
 * Compact badge showing agent emoji + name, optionally clickable to navigate
 * to the agent detail panel.
 */
export function AgentBadge({ agentId, agentName, emoji, onClick }: AgentBadgeProps) {
  const setActivePanel = useUIStore((s) => s.setActivePanel);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setActivePanel("agents");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium",
        "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
        "hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]",
        "transition-colors duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
      )}
      title={agentId}
    >
      {emoji && <span className="text-sm leading-none">{emoji}</span>}
      <span className="truncate max-w-[120px]">{agentName || agentId}</span>
    </button>
  );
}
