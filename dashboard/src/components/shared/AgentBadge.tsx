"use client";

import { navigateToAgent } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";

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
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigateToAgent(agentId);
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          handleClick();
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium",
        "bg-[var(--muted)] text-[var(--foreground)]",
        "hover:bg-[var(--primary-muted)] hover:text-[var(--primary)]",
        "transition-colors duration-150 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50",
      )}
      title={agentId}
    >
      {emoji && <span className="text-sm leading-none">{emoji}</span>}
      <span className="truncate max-w-[120px]">{agentName || agentId}</span>
    </span>
  );
}
